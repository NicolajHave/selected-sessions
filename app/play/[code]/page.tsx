'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  supabase,
  type Game,
  type GameState,
  type Question,
  type Submission,
  type Team,
} from '@/lib/supabase/client';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { SelectedSessionsLoader } from '@/components/SelectedSessionsLoader';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCurrentQuestion = useCallback(
    async (questionId: string | null) => {
      if (!questionId) {
        setCurrentQuestion(null);
        setMySubmission(null);
        setAnswer('');
        return;
      }
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();
      setCurrentQuestion(data);
    },
    []
  );

  const loadMySubmission = useCallback(
    async (questionId: string | null, teamId: string) => {
      if (!questionId) {
        setMySubmission(null);
        return;
      }
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('question_id', questionId)
        .eq('team_id', teamId)
        .maybeSingle();
      setMySubmission(data);
    },
    []
  );

  useEffect(() => {
    async function init() {
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (!gameData) {
        router.push('/');
        return;
      }

      setGame(gameData);

      const teamId =
        typeof window !== 'undefined'
          ? localStorage.getItem(`ss_team_${gameData.id}`)
          : null;

      if (!teamId) {
        router.push(`/join/${code}`);
        return;
      }

      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

      if (!teamData) {
        router.push(`/join/${code}`);
        return;
      }

      setTeam(teamData);

      const { data: stateData } = await supabase
        .from('game_state')
        .select('*')
        .eq('game_id', gameData.id)
        .single();

      setGameState(stateData);

      if (stateData?.current_question_id) {
        await loadCurrentQuestion(stateData.current_question_id);
        await loadMySubmission(stateData.current_question_id, teamData.id);
      }

      setLoading(false);
    }

    init();
  }, [code, router, loadCurrentQuestion, loadMySubmission]);

  // Realtime subscription on game_state
  useEffect(() => {
    if (!game) return;

    const channel = supabase
      .channel(`game_state:${game.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_state',
          filter: `game_id=eq.${game.id}`,
        },
        async (payload) => {
          const newState = payload.new as GameState;
          setGameState(newState);
          if (newState.current_question_id !== currentQuestion?.id) {
            await loadCurrentQuestion(newState.current_question_id);
            if (team) {
              await loadMySubmission(newState.current_question_id, team.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, team, currentQuestion?.id, loadCurrentQuestion, loadMySubmission]);

  // Realtime subscription on team score
  useEffect(() => {
    if (!team) return;

    const channel = supabase
      .channel(`team:${team.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `id=eq.${team.id}`,
        },
        (payload) => {
          setTeam(payload.new as Team);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || !currentQuestion || !team) return;

    setSubmitting(true);

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        question_id: currentQuestion.id,
        team_id: team.id,
        answer_text: answer.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMySubmission(data);
      setAnswer('');
    }

    setSubmitting(false);
  };

  if (loading) {
    return <SelectedSessionsLoader srLabel="Joining the session" />;
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex justify-between items-center border-b border-stone-200">
        <Logo size="sm" />
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-stone-500">
            {team?.name}
          </p>
          <p className="font-serif italic text-lg">{team?.score} pts</p>
        </div>
      </header>

      <div className="flex-1 px-6 py-8">
        {/* Leaderboard view */}
        {gameState?.show_leaderboard && (
          <div className="text-center mt-12">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
              Standings
            </p>
            <h2 className="font-serif text-3xl mb-8">
              On the <span className="italic">big screen</span>
            </h2>
            <p className="text-stone-600 text-sm">
              Look up — the leaderboard is live.
            </p>
          </div>
        )}

        {/* No question selected */}
        {!gameState?.show_leaderboard && !currentQuestion && (
          <div className="text-center mt-16">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
              Standby
            </p>
            <h2 className="font-serif text-3xl leading-tight">
              Waiting for the
              <br />
              <span className="italic">next round</span>
            </h2>
            <p className="mt-8 text-stone-500 text-sm">
              The host is preparing the next question.
            </p>
            <div className="mt-10">
              <SelectedSessionsLoader
                fullScreen={false}
                showLogo={false}
                size="sm"
                background="transparent"
                srLabel="Preparing the next round"
              />
            </div>
          </div>
        )}

        {/* Active question */}
        {!gameState?.show_leaderboard && currentQuestion && (
          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                {currentQuestion.points} points · {currentQuestion.type}
              </p>
              <h2 className="font-serif text-2xl leading-snug">
                {currentQuestion.prompt}
              </h2>
            </div>

            {gameState?.answer_revealed ? (
              <div className="border-t border-ink pt-6">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                  Correct answer
                </p>
                <p className="font-serif italic text-2xl">
                  {currentQuestion.answer}
                </p>
                {mySubmission && (
                  <div className="mt-8">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Your answer
                    </p>
                    <p className="text-stone-700">{mySubmission.answer_text}</p>
                  </div>
                )}
              </div>
            ) : mySubmission ? (
              <div className="border-t border-stone-200 pt-6">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                  Submitted
                </p>
                <p className="font-serif italic text-xl text-stone-700">
                  &ldquo;{mySubmission.answer_text}&rdquo;
                </p>
                <p className="mt-6 text-sm text-stone-500">
                  Sit tight — the host will reveal soon.
                </p>
                <div className="mt-8">
                  <SelectedSessionsLoader
                    fullScreen={false}
                    showLogo={false}
                    size="sm"
                    background="transparent"
                    srLabel="Awaiting reveal"
                  />
                </div>
              </div>
            ) : gameState?.answers_open ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Your answer"
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoFocus
                  maxLength={120}
                  className="text-lg"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting || !answer.trim()}
                >
                  {submitting ? 'Submitting...' : 'Submit answer'}
                </Button>
              </form>
            ) : (
              <div className="border-t border-stone-200 pt-6">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                  Answers locked
                </p>
                <p className="text-stone-600">
                  Waiting for the host to open submissions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
