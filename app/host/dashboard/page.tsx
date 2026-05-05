import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isHostAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Logo } from '@/components/shared/Logo';

export const dynamic = 'force-dynamic';

export default async function HostDashboard() {
  if (!isHostAuthenticated()) {
    redirect('/host');
  }

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center border-b border-stone-200">
        <Logo size="sm" />
        <span className="text-xs uppercase tracking-widest text-stone-500">
          Host
        </span>
      </header>

      <div className="flex-1 px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
              Control room
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-tight tracking-tight">
              Sessions
            </h1>
          </div>

          {games && games.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
                Active sessions
              </p>
              <ul className="space-y-px border-t border-stone-200">
                {games.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between py-6 border-b border-stone-200"
                  >
                    <div>
                      <p className="font-serif text-3xl tracking-tight">
                        {g.code}
                      </p>
                      <p className="text-xs uppercase tracking-widest text-stone-500 mt-1">
                        {g.status}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Link
                        href={`/screen/${g.code}`}
                        target="_blank"
                        className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors self-center"
                      >
                        Big screen ↗
                      </Link>
                      <Link
                        href={`/host/game/${g.code}`}
                        className="bg-ink text-paper px-6 py-3 text-sm font-medium tracking-wide hover:opacity-90 transition-opacity"
                      >
                        Open control
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-stone-500">No sessions yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
