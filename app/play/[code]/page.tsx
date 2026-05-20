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
import { getSelectedBangersEntry } from '@/lib/quiz/selected-bangers';

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
  const [categoryName, setCategoryName] = useState<string | undefined>(
    undefined
  );
  const [hintPurchased, setHintPurchased] = useState(false);
  const [sliderYear, setSliderYear] = useState<number | null>(null);

  const loadCurrentQuestion = useCallback(
    async (questionId: string | null) => {
      if (!questionId) {
        setCurrentQuestion(null);
        setMySubmission(null);
        setAnswer('');
        setCategoryName(undefined);
        setHintPurchased(false);
        setSliderYear(null);
        return;
      }
      const { data } = await supabase
        .from('questions')
        .select('*, categories(name)')
        .eq('id', questionId)
        .single();
      setCurrentQuestion(data);
      // categories is joined as an object via the FK relationship.
      const catName = (data as { categories?: { name?: string } } | null)
        ?.categories?.name;
      setCategoryName(catName);
    },
    []
  );

  const loadHint = useCallback(
    async (questionId: string | null, teamId: string) => {
      if (!questionId) {
        setHintPurchased(false);
        return;
      }
      const { data } = await supabase
        .from('team_question_hints')
        .select('id')
        .eq('question_id', questionId)
        .eq('team_id', teamId)
        .maybeSingle();
      setHintPurchased(!!data);
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
        await loadHint(stateData.current_question_id, teamData.id);
      }

      setLoading(false);
    }

    init();
  }, [code, router, loadCurrentQuestion, loadMySubmission, loadHint]);

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
              await loadHint(newState.current_question_id, team.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    game,
    team,
    currentQuestion?.id,
    loadCurrentQuestion,
    loadMySubmission,
    loadHint,
  ]);

  // Realtime: this team's hint purchases (host grants a private hint).
  useEffect(() => {
    if (!team) return;
    const channel = supabase
      .channel(`team_hints:${team.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_question_hints',
          filter: `team_id=eq.${team.id}`,
        },
        (payload) => {
          const row = payload.new as { question_id?: string };
          if (row.question_id && row.question_id === currentQuestion?.id) {
            setHintPurchased(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team, currentQuestion?.id]);

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

  const handleSubmit = async (e: React.FormEvent, explicitValue?: string) => {
    e.preventDefault();
    const finalAnswer = (explicitValue ?? answer).trim();
    if (!finalAnswer || !currentQuestion || !team) return;

    setSubmitting(true);

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        question_id: currentQuestion.id,
        team_id: team.id,
        answer_text: finalAnswer,
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
                size="sm"
                background="transparent"
                srLabel="Preparing the next round"
              />
            </div>
          </div>
        )}

        {/* Active question */}
        {!gameState?.show_leaderboard && currentQuestion && (() => {
          const sb = getSelectedBangersEntry(
            categoryName,
            currentQuestion.points
          );
          const isYearSlider = sb?.type === 'year-slider' && !!sb.slider;
          const sliderCfg = sb?.slider;
          // Default the slider to the midpoint once, when entering the question.
          const yearValue =
            sliderYear ??
            (sliderCfg
              ? Math.round((sliderCfg.min + sliderCfg.max) / 2)
              : 0);

          return (
          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                {currentQuestion.points} points
              </p>
              <h2 className="font-serif text-2xl leading-snug">
                {sb?.prompt ?? currentQuestion.prompt}
              </h2>
              {sb?.trackInfo && (
                <p className="font-serif italic text-lg text-stone-600 mt-3">
                  {sb.trackInfo}
                </p>
              )}
            </div>

            {/* Private paid hint — only visible to a team that bought it */}
            {sb?.hint && hintPurchased && (
              <div className="mb-8 border border-stone-200 p-4">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                  Your hint
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(sb.hint.image)}
                  alt="Purchased hint"
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      'none';
                  }}
                />
              </div>
            )}

            {gameState?.answer_revealed ? (
              <div className="border-t border-ink pt-6">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                  Correct answer
                </p>
                <p className="font-serif italic text-2xl">
                  {sb?.answer ?? currentQuestion.answer}
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
                    size="sm"
                    background="transparent"
                    srLabel="Awaiting reveal"
                  />
                </div>
              </div>
            ) : gameState?.answers_open ? (
              isYearSlider && sliderCfg ? (
                <form
                  onSubmit={(e) => handleSubmit(e, String(yearValue))}
                  className="space-y-8"
                >
                  <div>
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-6">
                      Drag to your year
                    </p>
                    <p className="font-serif text-6xl text-center mb-6">
                      {yearValue}
                    </p>
                    <input
                      type="range"
                      min={sliderCfg.min}
                      max={sliderCfg.max}
                      step={sliderCfg.step}
                      value={yearValue}
                      onChange={(e) => setSliderYear(Number(e.target.value))}
                      className="w-full accent-ink"
                    />
                    <div className="flex justify-between text-xs uppercase tracking-widest text-stone-400 mt-2">
                      <span>{sliderCfg.min}</span>
                      <span>{sliderCfg.max}</span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : `Submit ${yearValue}`}
                  </Button>
                </form>
              ) : (
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
              )
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
          );
        })()}
      </div>
    </main>
  );
}
