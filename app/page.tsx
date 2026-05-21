'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!clean) {
      setError('Enter a game code');
      return;
    }
    router.push(`/join/${clean}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center">
        <span className="text-[11px] uppercase tracking-[0.3em] text-stone-500">
          B2B Teamday
        </span>
        <a
          href="/host"
          className="text-[11px] uppercase tracking-[0.3em] text-stone-500 hover:text-ink transition-colors"
        >
          Host
        </a>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
        <div className="max-w-md w-full">
          {/* Hero: logo + Sessions */}
          <div className="flex justify-center mb-12">
            <Logo size="xl" align="center" />
          </div>

          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-stone-500 mb-12">
            A live music quiz · curated for the team day
          </p>

          {/* Join form */}
          <form onSubmit={handleJoin} className="space-y-8">
            <Input
              label="Game code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              autoFocus
              maxLength={16}
              className="uppercase tracking-[0.3em] text-2xl text-center"
            />

            {error && <p className="text-sm text-clay text-center">{error}</p>}

            <Button type="submit" size="lg" className="w-full">
              Join the session
            </Button>
          </form>
        </div>
      </div>

      <footer className="px-8 py-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400">
          Selected · B2B Communication
        </p>
      </footer>
    </main>
  );
}
