import { supabase } from '@/lib/supabase/client';

export default async function Home() {
  const { data: games, error } = await supabase
    .from('games')
    .select('*');

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-900 p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl font-light tracking-tight mb-4">
          Selected Sessions
        </h1>
        <p className="text-stone-600 mb-8">
          Connection test — under construction
        </p>

        <div className="border border-stone-200 rounded-md p-6 bg-white">
          <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
            Supabase status
          </h2>
          {error ? (
            <p className="text-red-600">❌ Error: {error.message}</p>
          ) : (
            <p className="text-emerald-700">
              ✅ Connected. Found {games?.length ?? 0} games.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
