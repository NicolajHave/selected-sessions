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
import {
  getSelectedOrRejectedEntry,
  type SorChoice,
} from '@/lib/quiz/selected-or-rejected';
import { getFinishTheOutfitEntry } from '@/lib/quiz/finish-the-outfit';
import { getArchiveSoundsEntry } from '@/lib/quiz/archive-sounds';
import { INTRO_QUESTION } from '@/lib/quiz/intro-question';

/** Visual countdown for a timed round. Remount (via key) to restart. */
function RoundTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    const started = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs uppercase tracking-widest text-stone-500 mb-2">
        <span>Time</span>
        <span>{remaining}s</span>
      </div>
      <div className="h-1 bg-stone-200">
        <div
          className="h-1 bg-ink transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
  // Two-round questions (Q200): answer stored per round index.
  const [myRounds, setMyRounds] = useState<Record<number, string>>({});
  // CHANCEN (Q400): the team's submitted wager for the current question.
  const [myWager, setMyWager] = useState<number | null>(null);
  const [wagerInput, setWagerInput] = useState<string>('');
  // Multi-select (Q500): currently-checked song indices.
  const [multiSelect, setMultiSelect] = useState<number[]>([]);
  const [multiError, setMultiError] = useState('');
  // Fastest Fit First (intro question).
  const [introSlots, setIntroSlots] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [introSubmitted, setIntroSubmitted] = useState(false);
  const [introNow, setIntroNow] = useState(Date.now());
  // Finish the (Out)fit: the team's bonus answer (Q400), if submitted.
  const [myBonusAnswer, setMyBonusAnswer] = useState<string | null>(null);

  const loadCurrentQuestion = useCallback(
    async (questionId: string | null) => {
      if (!questionId) {
        setCurrentQuestion(null);
        setMySubmission(null);
        setAnswer('');
        setCategoryName(undefined);
        setHintPurchased(false);
        setSliderYear(null);
        setMyWager(null);
        setWagerInput('');
        setMultiSelect([]);
        setMultiError('');
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
      // Reset transient inputs for the new question.
      setWagerInput('');
      setMultiSelect([]);
      setMultiError('');
    },
    []
  );

  const loadMyWager = useCallback(
    async (questionId: string | null, teamId: string) => {
      if (!questionId) {
        setMyWager(null);
        return;
      }
      const { data } = await supabase
        .from('question_wagers')
        .select('wager_amount')
        .eq('question_id', questionId)
        .eq('team_id', teamId)
        .maybeSingle();
      setMyWager(data ? data.wager_amount : null);
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
        setMyRounds({});
        setMyBonusAnswer(null);
        return;
      }
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('question_id', questionId)
        .eq('team_id', teamId)
        .order('submitted_at');
      const rows = data ?? [];
      // Bonus answer (Finish the (Out)fit Q400) is stored on its own row.
      const bonusRow = rows.find(
        (s) => (s.answer_payload as { bonusAnswer?: string })?.bonusAnswer
      );
      setMyBonusAnswer(
        bonusRow
          ? ((bonusRow.answer_payload as { bonusAnswer?: string }).bonusAnswer ??
              null)
          : null
      );
      // Primary answer row = not a bonus row and not a per-round row.
      const mainRow =
        rows.find((s) => {
          const p = s.answer_payload as {
            bonusAnswer?: string;
            roundIndex?: number;
          };
          return !p?.bonusAnswer && p?.roundIndex == null;
        }) ?? (rows.length ? rows[rows.length - 1] : null);
      setMySubmission(mainRow);
      // Two-round questions: map each round's stored answer.
      const rounds: Record<number, string> = {};
      for (const s of rows) {
        const p = s.answer_payload as { roundIndex?: number; answer?: string };
        if (typeof p?.roundIndex === 'number' && p.answer) {
          rounds[p.roundIndex] = p.answer;
        }
      }
      setMyRounds(rounds);
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
        await loadMyWager(stateData.current_question_id, teamData.id);
      }

      setLoading(false);
    }

    init();
  }, [
    code,
    router,
    loadCurrentQuestion,
    loadMySubmission,
    loadHint,
    loadMyWager,
  ]);

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
              await loadMyWager(newState.current_question_id, team.id);
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
    loadMyWager,
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

  // Two-round choice (Q200): one submission row per round so answers are
  // preserved separately (Round 1 is never overwritten by Round 2).
  const submitRoundChoice = async (roundIndex: number, choice: SorChoice) => {
    if (!currentQuestion || !team) return;
    if (myRounds[roundIndex]) return; // already answered this round
    setSubmitting(true);
    const { error } = await supabase.from('submissions').insert({
      question_id: currentQuestion.id,
      team_id: team.id,
      answer_text: choice,
      answer_payload: { roundIndex, answer: choice },
    });
    if (!error) setMyRounds((prev) => ({ ...prev, [roundIndex]: choice }));
    setSubmitting(false);
  };

  // CHANCEN (Q400): submit a wager into question_wagers.
  const submitWager = async (amount: number) => {
    if (!currentQuestion || !team) return;
    setSubmitting(true);
    const { error } = await supabase.from('question_wagers').insert({
      game_id: team.game_id,
      team_id: team.id,
      question_id: currentQuestion.id,
      wager_amount: amount,
    });
    if (!error) setMyWager(amount);
    setSubmitting(false);
  };

  // Multi-select (Q500): submit exactly 3 selected song indices.
  const submitMultiSelect = async () => {
    if (!currentQuestion || !team) return;
    if (multiSelect.length !== 3) {
      setMultiError('Select exactly 3 songs.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        question_id: currentQuestion.id,
        team_id: team.id,
        answer_text: `${multiSelect.length} selected`,
        answer_payload: { selected: multiSelect },
      })
      .select()
      .single();
    if (!error && data) setMySubmission(data);
    setSubmitting(false);
  };

  // Fastest Fit First: submit the team's ordered options.
  const submitIntroOrder = async () => {
    if (!team || !game) return;
    if (introSlots.some((s) => s == null)) return;
    setSubmitting(true);
    const { error } = await supabase.from('intro_submissions').insert({
      game_id: game.id,
      team_id: team.id,
      submitted_order: introSlots,
    });
    if (!error) setIntroSubmitted(true);
    setSubmitting(false);
  };

  // Reset intro slots when a new intro round begins; restore "locked" state
  // if this team already submitted (e.g. page reload).
  useEffect(() => {
    if (!gameState?.intro_mode_active || !game || !team) {
      setIntroSubmitted(false);
      setIntroSlots([null, null, null, null]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('intro_submissions')
        .select('id')
        .eq('game_id', game.id)
        .eq('team_id', team.id)
        .maybeSingle();
      if (!cancelled) setIntroSubmitted(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameState?.intro_mode_active, gameState?.intro_started_at, game, team]);

  // Tick while intro countdown is running.
  useEffect(() => {
    if (!gameState?.intro_mode_active || gameState?.intro_revealed) return;
    const id = setInterval(() => setIntroNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [gameState?.intro_mode_active, gameState?.intro_revealed]);

  // Finish the (Out)fit: submit the typed lyric (host-scored manually).
  const submitLyric = async (text: string) => {
    if (!currentQuestion || !team) return;
    const clean = text.trim();
    if (!clean) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        question_id: currentQuestion.id,
        team_id: team.id,
        answer_text: clean,
        answer_payload: { lyricAnswer: clean },
      })
      .select()
      .single();
    if (!error && data) {
      setMySubmission(data);
      setAnswer('');
    }
    setSubmitting(false);
  };

  // Finish the (Out)fit Q400: submit the bonus answer (auto-scored on reveal).
  const submitBonus = async (option: string) => {
    if (!currentQuestion || !team) return;
    setSubmitting(true);
    const { error } = await supabase.from('submissions').insert({
      question_id: currentQuestion.id,
      team_id: team.id,
      answer_text: `Bonus: ${option}`,
      answer_payload: { bonusAnswer: option },
    });
    if (!error) setMyBonusAnswer(option);
    setSubmitting(false);
  };

  // Selected/Rejected choice submission (auto-scored on reveal by the host API).
  const submitChoice = async (choice: SorChoice) => {
    if (!currentQuestion || !team) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        question_id: currentQuestion.id,
        team_id: team.id,
        answer_text: choice,
        answer_payload: { answer: choice },
      })
      .select()
      .single();
    if (!error && data) setMySubmission(data);
    setSubmitting(false);
  };

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
        {gameState?.intro_mode_active ? (
          (() => {
            const startedMs = gameState.intro_started_at
              ? new Date(gameState.intro_started_at).getTime()
              : 0;
            const elapsedSec = startedMs
              ? (introNow - startedMs) / 1000
              : 0;
            const remaining = Math.max(
              0,
              INTRO_QUESTION.timerSeconds - elapsedSec,
            );
            const pct = (remaining / INTRO_QUESTION.timerSeconds) * 100;
            const expired = remaining <= 0;
            const used = new Set(introSlots.filter(Boolean) as string[]);
            const remainingOptions = INTRO_QUESTION.options.filter(
              (o) => !used.has(o),
            );
            const filled = introSlots.every((s) => s != null);
            const locked =
              introSubmitted || expired || !!gameState.intro_revealed;
            return (
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">
                    {INTRO_QUESTION.title}
                  </p>
                  <h2 className="font-serif text-2xl leading-snug">
                    {INTRO_QUESTION.prompt}
                  </h2>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-xs uppercase tracking-widest text-stone-500">
                      Time
                    </p>
                    <p className="font-serif text-2xl">
                      {Math.ceil(remaining)}s
                    </p>
                  </div>
                  <div className="h-1 bg-stone-200">
                    <div
                      className="h-1 bg-ink transition-[width] duration-300 ease-linear"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {gameState.intro_revealed ? (
                  <div className="border-t border-ink pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Revealed
                    </p>
                    <p className="text-stone-600">
                      Look up — results are on the big screen.
                    </p>
                  </div>
                ) : locked ? (
                  <div className="border-t border-stone-200 pt-6 text-center">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      {introSubmitted ? 'Answer locked' : "Time's up"}
                    </p>
                    {introSubmitted && (
                      <p className="text-stone-600">
                        Wait for the host to reveal.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                      Your order
                    </p>
                    <ol className="space-y-2 mb-6">
                      {introSlots.map((s, i) => (
                        <li key={i}>
                          <button
                            disabled={!s}
                            onClick={() =>
                              setIntroSlots((prev) =>
                                prev.map((v, j) => (j === i ? null : v)),
                              )
                            }
                            className={`w-full text-left px-4 py-3 border ${
                              s
                                ? 'border-ink bg-ink text-paper'
                                : 'border-dashed border-stone-300 text-stone-400'
                            } text-sm flex items-center gap-3`}
                          >
                            <span className="font-serif italic text-base opacity-70">
                              {i + 1}.
                            </span>
                            <span className="flex-1">
                              {s ?? 'Tap an option below'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>

                    {remainingOptions.length > 0 && (
                      <>
                        <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                          Options
                        </p>
                        <ul className="space-y-2 mb-6">
                          {remainingOptions.map((opt) => (
                            <li key={opt}>
                              <button
                                onClick={() =>
                                  setIntroSlots((prev) => {
                                    const next = [...prev];
                                    const empty = next.findIndex(
                                      (v) => v == null,
                                    );
                                    if (empty >= 0) next[empty] = opt;
                                    return next;
                                  })
                                }
                                className="w-full text-left px-4 py-3 border border-stone-300 text-sm hover:border-ink transition-colors"
                              >
                                {opt}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!filled || submitting}
                      onClick={submitIntroOrder}
                    >
                      {submitting ? 'Submitting...' : 'Lock answer'}
                    </Button>
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <>
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
          const sor = getSelectedOrRejectedEntry(
            categoryName,
            currentQuestion.points
          );
          const fto = getFinishTheOutfitEntry(
            categoryName,
            currentQuestion.points
          );
          const as = getArchiveSoundsEntry(
            categoryName,
            currentQuestion.points
          );

          // Finish the (Out)fit — listen, then type the missing lyric.
          if (fto) {
            const answersOpenF = !!gameState?.answers_open;
            const revealedF = !!gameState?.answer_revealed;
            const submittedMain = !!mySubmission;
            return (
              <div className="max-w-md mx-auto">
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                    {currentQuestion.points} points · {fto.title}
                  </p>
                  <h2 className="font-serif text-2xl leading-snug">
                    {fto.prompt}
                  </h2>
                </div>

                {/* Private paid hint (Q500) — only for the buying team */}
                {fto.hint && hintPurchased && (
                  <div className="mb-8 border border-stone-200 p-4">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Your hint
                    </p>
                    <p className="font-serif italic text-xl">{fto.hint.text}</p>
                  </div>
                )}

                {revealedF ? (
                  <div className="border-t border-ink pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Revealed
                    </p>
                    {fto.correctAnswer ? (
                      <p className="font-serif italic text-2xl">
                        {fto.correctAnswer}
                      </p>
                    ) : (
                      <p className="text-stone-600">
                        Look up — the answer is on the big screen.
                      </p>
                    )}
                    {submittedMain && (
                      <p className="mt-4 text-sm text-stone-500">
                        Your answer: {mySubmission?.answer_text}
                      </p>
                    )}
                    {fto.bonus && myBonusAnswer && (
                      <p className="mt-2 text-sm text-stone-500">
                        Bonus: {myBonusAnswer}
                      </p>
                    )}
                  </div>
                ) : !answersOpenF ? (
                  <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-stone-500 mb-6">
                      Listen…
                    </p>
                    <SelectedSessionsLoader
                      fullScreen={false}
                      size="sm"
                      background="transparent"
                      srLabel="Listening"
                    />
                    <p className="mt-6 text-sm text-stone-500">
                      Answers open the moment the song stops.
                    </p>
                  </div>
                ) : !submittedMain ? (
                  <div className="space-y-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
                      Finish the next line
                    </p>
                    <p className="font-serif text-2xl tracking-[0.15em] text-stone-500">
                      {fto.maskedAnswer}
                    </p>
                    <Input
                      label="The missing line"
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      autoFocus
                      maxLength={120}
                      className="text-lg"
                    />
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={submitting || !answer.trim()}
                      onClick={() => submitLyric(answer)}
                    >
                      {submitting ? 'Submitting...' : 'Submit answer'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="border-t border-stone-200 pt-6">
                      <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                        Submitted
                      </p>
                      <p className="font-serif italic text-xl text-stone-700">
                        &ldquo;{mySubmission?.answer_text}&rdquo;
                      </p>
                      <p className="mt-4 text-sm text-stone-500">
                        The host will score it. Sit tight.
                      </p>
                    </div>

                    {/* Q400 bonus — appears only after the main answer */}
                    {fto.bonus && (
                      <div className="border-t border-stone-200 pt-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-3">
                          Bonus
                        </p>
                        <p className="font-serif text-xl mb-4">
                          {fto.bonus.prompt}
                        </p>
                        {myBonusAnswer ? (
                          <p className="text-sm text-stone-600">
                            Locked in: <strong>{myBonusAnswer}</strong>
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {fto.bonus.options.map((opt) => (
                              <button
                                key={opt}
                                disabled={submitting}
                                onClick={() => submitBonus(opt)}
                                className="border border-stone-300 px-4 py-3 text-left text-sm hover:border-ink transition-colors disabled:opacity-40"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Q200 two-round flow — dedicated rendering with its own per-round
          // storage, so it must take precedence over the single-submission view.
          if (sor?.type === 'tworound' && sor.rounds) {
            const rounds = sor.rounds;
            const activeRound = gameState?.active_round ?? 0;
            const revealedTR = !!gameState?.answer_revealed;
            const answersOpenTR = !!gameState?.answers_open;
            const round = rounds[activeRound] ?? rounds[0];
            const myAnswerThisRound = myRounds[activeRound];
            return (
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                    {currentQuestion.points} points · {sor.title}
                  </p>
                  {!revealedTR && (
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Round {activeRound + 1} of {rounds.length}
                    </p>
                  )}
                </div>

                {revealedTR ? (
                  <div className="border-t border-ink pt-6 space-y-6">
                    {rounds.map((r, i) => (
                      <div key={i}>
                        <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                          Round {i + 1} — “{r.statement}”
                        </p>
                        <p className="font-serif italic text-xl">{r.correct}</p>
                        <p className="text-sm text-stone-600 mt-1">
                          {r.explanation}
                        </p>
                        <p className="text-xs text-stone-500 mt-2">
                          Your answer: {myRounds[i] ?? '—'}
                          {myRounds[i] === r.correct ? ' · +100' : ' · 0'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <h2 className="font-serif text-3xl leading-snug mb-2">
                      “{round.statement}”
                    </h2>
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500 mb-6">
                      Selected or Rejected?
                    </p>
                    {myAnswerThisRound ? (
                      <div className="border-t border-stone-200 pt-6">
                        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                          Locked in for round {activeRound + 1}
                        </p>
                        <p className="font-serif italic text-xl text-stone-700">
                          &ldquo;{myAnswerThisRound}&rdquo;
                        </p>
                        <p className="mt-4 text-sm text-stone-500">
                          Wait for the host to continue.
                        </p>
                      </div>
                    ) : answersOpenTR ? (
                      <div>
                        <div className="grid grid-cols-1 gap-4">
                          {(['Selected', 'Rejected'] as SorChoice[]).map(
                            (choice) => (
                              <button
                                key={choice}
                                disabled={submitting}
                                onClick={() =>
                                  submitRoundChoice(activeRound, choice)
                                }
                                className="border-2 border-ink py-8 font-serif text-3xl hover:bg-ink hover:text-paper transition-colors disabled:opacity-40"
                              >
                                {choice}
                              </button>
                            )
                          )}
                        </div>
                        <RoundTimer
                          key={`${activeRound}-${answersOpenTR}`}
                          seconds={round.timerSeconds}
                        />
                      </div>
                    ) : (
                      <div className="border-t border-stone-200 pt-6">
                        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                          Answers locked
                        </p>
                        <p className="text-stone-600">Waiting for the host.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Q400 CHANCEN — wager first, then Selected/Rejected.
          if (sor?.type === 'chance') {
            const revealedC = !!gameState?.answer_revealed;
            const chanceStarted = !!gameState?.chance_started;
            const score = team?.score ?? 0;
            const baseMin = sor.minWager ?? 400;
            const minW = score <= 0 ? 0 : score < baseMin ? score : baseMin;
            const maxW = Math.max(0, score);
            const fixedWager = minW === maxW;
            const wagerNum = Number(wagerInput);
            const wagerValid =
              wagerInput !== '' &&
              Number.isFinite(wagerNum) &&
              wagerNum >= minW &&
              wagerNum <= maxW;
            return (
              <div className="max-w-md mx-auto">
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                    {currentQuestion.points} points · {sor.title}
                  </p>
                  <h2 className="font-serif text-3xl leading-snug">
                    {chanceStarted || revealedC
                      ? sor.prompt
                      : 'Place your wager'}
                  </h2>
                  {(chanceStarted || revealedC) && sor.subPrompt && (
                    <p className="text-sm uppercase tracking-[0.2em] text-stone-500 mt-3">
                      {sor.subPrompt}
                    </p>
                  )}
                </div>

                {revealedC ? (
                  <div className="border-t border-ink pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Correct answer
                    </p>
                    <p className="font-serif italic text-2xl">{sor.correct}</p>
                    {sor.revealExplanation && (
                      <p className="mt-3 text-sm text-stone-600">
                        {sor.revealExplanation}
                      </p>
                    )}
                    <p className="mt-6 text-sm text-stone-500">
                      Your answer: {mySubmission?.answer_text ?? '—'} · Wager:{' '}
                      {myWager ?? 0}
                      {mySubmission
                        ? mySubmission.answer_text === sor.correct
                          ? ` · +${myWager ?? 0}`
                          : ` · −${myWager ?? 0}`
                        : ''}
                    </p>
                  </div>
                ) : !chanceStarted ? (
                  myWager != null ? (
                    <div className="border-t border-stone-200 pt-6">
                      <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                        Wager locked
                      </p>
                      <p className="font-serif italic text-3xl">{myWager}</p>
                      <p className="mt-4 text-sm text-stone-500">
                        Wait for the host to start the question.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-sm text-stone-600">
                        Your score: <strong>{score}</strong> · Wager between{' '}
                        {minW} and {maxW}.
                      </p>
                      {fixedWager ? (
                        <Button
                          size="lg"
                          className="w-full"
                          disabled={submitting}
                          onClick={() => submitWager(minW)}
                        >
                          {submitting ? 'Submitting...' : `Wager ${minW}`}
                        </Button>
                      ) : (
                        <>
                          <Input
                            label="Your wager"
                            type="number"
                            inputMode="numeric"
                            min={minW}
                            max={maxW}
                            value={wagerInput}
                            onChange={(e) => setWagerInput(e.target.value)}
                            className="text-2xl text-center"
                          />
                          <Button
                            size="lg"
                            className="w-full"
                            disabled={submitting || !wagerValid}
                            onClick={() => submitWager(wagerNum)}
                          >
                            {submitting
                              ? 'Submitting...'
                              : wagerValid
                                ? `Wager ${wagerNum}`
                                : `Enter ${minW}–${maxW}`}
                          </Button>
                        </>
                      )}
                    </div>
                  )
                ) : mySubmission ? (
                  <div className="border-t border-stone-200 pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Submitted · wager {myWager ?? 0}
                    </p>
                    <p className="font-serif italic text-xl text-stone-700">
                      &ldquo;{mySubmission.answer_text}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {(['Selected', 'Rejected'] as SorChoice[]).map((choice) => (
                      <button
                        key={choice}
                        disabled={submitting}
                        onClick={() => submitChoice(choice)}
                        className="border-2 border-ink py-8 font-serif text-3xl hover:bg-ink hover:text-paper transition-colors disabled:opacity-40"
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Q500 multi-select — pick exactly 3 songs.
          if (sor?.type === 'multiselect' && sor.songs) {
            const revealedM = !!gameState?.answer_revealed;
            const answersOpenM = !!gameState?.answers_open;
            const songs = sor.songs;
            const correct = new Set(sor.correctSongs ?? []);
            const mySel =
              (mySubmission?.answer_payload as { selected?: number[] })
                ?.selected ?? [];
            return (
              <div className="max-w-md mx-auto">
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                    {currentQuestion.points} points · {sor.title}
                  </p>
                  <h2 className="font-serif text-2xl leading-snug">
                    {sor.prompt}
                  </h2>
                </div>

                {revealedM ? (
                  <div className="border-t border-ink pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                      Correct songs
                    </p>
                    <ul className="space-y-1">
                      {songs.map((s, i) => {
                        const isCorrect = correct.has(i);
                        const iPicked = mySel.includes(i);
                        return (
                          <li
                            key={i}
                            className={`text-sm ${isCorrect ? 'font-serif italic text-lg text-ink' : 'text-stone-400'}`}
                          >
                            {isCorrect ? '★ ' : ''}
                            {s}
                            {iPicked ? ' · you' : ''}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-4 text-sm text-stone-600">
                      You got {mySel.filter((i) => correct.has(i)).length} of 3
                      correct.
                    </p>
                  </div>
                ) : mySubmission ? (
                  <div className="border-t border-stone-200 pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Submitted
                    </p>
                    <p className="text-sm text-stone-600">
                      Your 3 picks are locked in. Wait for the reveal.
                    </p>
                  </div>
                ) : answersOpenM ? (
                  <div className="space-y-4">
                    <ul className="space-y-2">
                      {songs.map((s, i) => {
                        const checked = multiSelect.includes(i);
                        return (
                          <li key={i}>
                            <button
                              onClick={() => {
                                setMultiError('');
                                setMultiSelect((prev) =>
                                  prev.includes(i)
                                    ? prev.filter((x) => x !== i)
                                    : prev.length >= 3
                                      ? prev
                                      : [...prev, i]
                                );
                              }}
                              className={`w-full text-left px-4 py-3 border text-sm transition-colors ${
                                checked
                                  ? 'border-ink bg-ink text-paper'
                                  : 'border-stone-300 hover:border-ink'
                              }`}
                            >
                              {s}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs uppercase tracking-widest text-stone-500">
                      {multiSelect.length} / 3 selected
                    </p>
                    {multiError && (
                      <p className="text-sm text-clay">{multiError}</p>
                    )}
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={submitting || multiSelect.length !== 3}
                      onClick={submitMultiSelect}
                    >
                      {submitting ? 'Submitting...' : 'Submit 3 songs'}
                    </Button>
                  </div>
                ) : (
                  <div className="border-t border-stone-200 pt-6">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Answers locked
                    </p>
                    <p className="text-stone-600">Waiting for the host.</p>
                  </div>
                )}
              </div>
            );
          }

          // Phase 2: single Selected/Rejected button input (Q100 + Q300).
          const isSorButtons =
            sor?.type === 'truefact' || sor?.type === 'majority';
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
              {as?.title && (
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">
                  {as.title}
                </p>
              )}
              <h2 className="font-serif text-2xl leading-snug">
                {sor?.prompt ?? sb?.prompt ?? as?.prompt ?? currentQuestion.prompt}
              </h2>
              {sor?.subPrompt && (
                <p className="text-sm uppercase tracking-[0.2em] text-stone-500 mt-3">
                  {sor.subPrompt}
                </p>
              )}
              {sor?.track && (
                <p className="font-serif italic text-lg text-stone-600 mt-3">
                  {sor.track}
                </p>
              )}
              {sb?.trackInfo && (
                <p className="font-serif italic text-lg text-stone-600 mt-3">
                  {sb.trackInfo}
                </p>
              )}
            </div>

            {/* Archive Sounds Q500 paid image hint */}
            {as?.hint && hintPurchased && (
              <div className="mb-8 border border-stone-200 p-4">
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                  Your hint
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(as.hint.image)}
                  alt={as.hint.alt ?? 'Purchased hint'}
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      'none';
                  }}
                />
              </div>
            )}

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
                  {sor?.correct ?? sb?.answer ?? currentQuestion.answer}
                </p>
                {sor?.revealExplanation && (
                  <p className="mt-3 text-sm text-stone-600">
                    {sor.revealExplanation}
                  </p>
                )}
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
              isSorButtons ? (
                <div className="grid grid-cols-1 gap-4">
                  {(['Selected', 'Rejected'] as SorChoice[]).map((choice) => (
                    <button
                      key={choice}
                      disabled={submitting}
                      onClick={() => submitChoice(choice)}
                      className="border-2 border-ink py-8 font-serif text-3xl hover:bg-ink hover:text-paper transition-colors disabled:opacity-40"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : isYearSlider && sliderCfg ? (
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
          </>
        )}
      </div>
    </main>
  );
}
