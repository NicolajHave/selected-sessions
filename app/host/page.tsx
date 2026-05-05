import { redirect } from 'next/navigation';
import { isHostAuthenticated } from '@/lib/auth';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export default function HostLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (isHostAuthenticated()) {
    redirect('/host/dashboard');
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center border-b border-stone-200">
        <Logo size="sm" />
        <a
          href="/"
          className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
        >
          Player
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="max-w-md w-full">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
              Host access
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-tight tracking-tight">
              Backstage
            </h1>
          </div>

          <form action="/api/host/login" method="POST" className="space-y-8">
            <Input
              label="Passcode"
              type="password"
              name="passcode"
              autoFocus
              required
              className="text-lg"
            />

            {searchParams.error && (
              <p className="text-sm text-clay">Wrong passcode. Try again.</p>
            )}

            <Button type="submit" size="lg" className="w-full">
              Enter
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
