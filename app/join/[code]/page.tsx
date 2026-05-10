'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, type Game, type Team } from '@/lib/supabase/client';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadGame() {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (gameError || !gameData) {
        setError(`No session found with code "${code}"`);
        setLoading(false);
        return;
      }

      setGame(gameData);

      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('game_id', gameData.id)
        .order('created_at', { ascending: true });

      setTeams(teamsData || []);
      setLoading(false);
    }

    loadGame();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !game) return;

    setSubmitting(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('teams')
      .insert({ game_id: game.id, name: teamName.trim() })
      .select()
      .single();

    if (insertError || !data) {
      setError('Could not create team. Try a different name.');
      setSubmitting(false);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`ss_team_${game.id}`, data.id);
      localStorage.setItem(`ss_team_name_${game.id}`, data.name);
    }

    router.push(`/play/${code}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400">
          Loading...
        </p>
      </main>
    );
  }

  if (error && !game) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <Logo size="md" align="center" />
        <p className="mt-12 text-stone-600">{error}</p>
        <a
          href="/"
          className="mt-8 text-[11px] uppercase tracking-[0.3em] text-ink underline underline-offset-4"
        >
          Back to start
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex justify-between items-center">
        <Logo size="sm" />
        <span className="text-[11px] uppercase tracking-[0.3em] text-stone-500">
          Code · {code}
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 mb-4">
              Step one
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight tracking-tight">
              Name your <span className="italic">team</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <Input
              label="Team name"
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setError('');
              }}
              placeholder="The Showroom Crew"
              autoFocus
              maxLength={40}
              className="text-xl"
            />

            {error && <p className="text-sm text-clay">{error}</p>}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || !teamName.trim()}
            >
              {submitting ? 'Joining...' : 'Enter the session'}
            </Button>
          </form>

          {teams.length > 0 && (
            <div className="mt-16">
              <p className="text-[11px] uppercase tracking-[0.3em] text-stone-500 mb-4">
                Already in the room ({teams.length})
              </p>
              <ul className="space-y-2">
                {teams.map((t) => (
                  <li
                    key={t.id}
                    className="text-sm text-stone-600 border-b border-stone-200 pb-2"
                  >
                    {t.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
