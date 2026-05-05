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
    if (!code.trim()) {
      setError('Enter a game code');
      return;
    }
    router.push(`/join/${code.trim().toUpperCase()}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-6 flex justify-between items-center border-b border-stone-200">
        <Logo size="sm" />
        <a
          href="/host"
          className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
        >
          Host
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="max-w-md w-full">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
              A live music quiz experience
            </p>
            <h1 className="font-serif text-5xl md:text-6xl leading-tight tracking-tight">
              Selected
              <br />
              <span className="italic">Sessions</span>
            </h1>
          </div>

          <form onSubmit={handleJoin} className="space-y-8">
            <Input
              label="Game code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              placeholder="DEMO"
              autoFocus
              maxLength={6}
              className="uppercase tracking-widest text-2xl"
            />

            {error && <p className="text-sm text-clay">{error}</p>}

            <Button type="submit" size="lg" className="w-full">
              Join the session
            </Button>
          </form>

          <p className="mt-16 text-xs uppercase tracking-widest text-stone-400">
            Curated for the team day
          </p>
        </div>
      </div>

      <footer className="px-8 py-6 border-t border-stone-200 text-center">
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Selected Sessions — Internal Edition
        </p>
      </footer>
    </main>
  );
}
