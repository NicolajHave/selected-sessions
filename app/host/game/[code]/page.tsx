'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  type Game,
  type GameState,
  type Category,
  type Question,
  type Submission,
  type Team,
} from '@/lib/supabase/client';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';

interface CategoryWithQuestions extends Category {
  questions: Question[];
}

export default function HostGamePage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [categories, setCategories] = useState<CategoryWithQuestions[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Data loaders ----

  const reloadQuestions = useCallback(async (gameId: string) => {
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('game_id', gameId)
      .order('position');

    if (!cats) return;

    const catsWithQs: CategoryWithQuestions[] = await Promise.all(
      cats.map(async (cat) => {
        const { data: qs } = await supabase
          .from('questions')
          .select('*')
          .eq('category_id', cat.id)
          .order('points');
        return { ...cat, questions: qs || [] };
      })
    );

    setCategories(catsWithQs);
  }, []);

  const reloadTeams = useCallback(async (gameId: string) => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: false });
    setTeams(data || []);
  }, []);

  const reloadSubmissions = useCallback(async (questionId: string | null) => {
    if (!questionId) {
      setSubmissions([]);
      return;
    }
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('question_id', questionId)
      .order('submitted_at');
    setSubmissions(data || []);
  }, []);

  const loadCurrentQuestion = useCallback(async (qid: string | null) => {
    if (!qid) {
      setCurrentQuestion(null);
      return;
    }
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('id', qid)
      .single();
    setCurrentQuestion(data);
  }, []);

  // ---- Init ----

  useEffect(() => {
    async function init() {
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (!gameData) {
        setLoading(false);
        return;
      }

      setGame(gameData);

      const { data: stateData } = await supabase
        .from('game_state')
        .select('*')
        .eq('game_id', gameData.id)
        .single();

      setGameState(stateData);
      await reloadQuestions(gameData.id);
      await reloadTeams(gameData.id);

      if (stateData?.current_question_id) {
        await loadCurrentQuestion(stateData.current_question_id);
        await reloadSubmissions(stateData.current_question_id);
      }

      setLoading(false);
    }

    init();
  }, [code, reloadQuestions, reloadTeams, reloadSubmissions, loadCurrentQuestion]);

  // ---- Realtime: submissions for current question ----

  useEffect(() => {
    if (!gameState?.current_question_id) return;
    const qid = gameState.current_question_id;

    const channel = supabase
      .channel(`submissions:${qid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
          filter: `question_id=eq.${qid}`,
        },
        () => {
          reloadSubmissions(qid);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameState?.current_question_id, reloadSubmissions]);

  // ---- Realtime: teams (for new joins) ----

  useEffect(() => {
    if (!game) return;

    const channel = supabase
      .channel(`teams:${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${game.id}`,
        },
        () => {
          reloadTeams(game.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, reloadTeams]);

  // ---- Host actions ----

  async function callApi(action: string, body: object = {}) {
    if (!game) return;
    const res = await fetch(`/api/games/${game.code}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Action failed:', err);
      return;
    }
    const updated = await res.json();
    if (updated.gameState) setGameState(updated.gameState);
    if (updated.team) {
      reloadTeams(game.id);
    }
  }

  async function selectQuestion(q: Question) {
    if (q.is_answered) return;
    await callApi('select_question', { question_id: q.id });
    await loadCurrentQuestion(q.id);
    await reloadSubmissions(q.id);
  }

  async function backToBoard() {
    await callApi('back_to_board');
    setCurrentQuestion(null);
    setSubmissions([]);
  }

  async function awardPoints(teamId: string, points: number) {
    if (!currentQuestion) return;
    await callApi('award_points', {
      team_id: teamId,
      points,
      question_id: currentQuestion.id,
    });
  }

  async function markAnswered(answered: boolean) {
    if (!currentQuestion || !game) return;
    await fetch(`/api/games/${game.code}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_answered',
        question_id: currentQuestion.id,
        answered,
      }),
    });
    await reloadQuestions(game.id);
    await loadCurrentQuestion(currentQuestion.id);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading...
        </p>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Session not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex justify-between items-center border-b border-stone-200">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-xs uppercase tracking-widest text-stone-500">
            Code · {game.code}
          </span>
          <span className="text-xs uppercase tracking-widest text-stone-500">
            Teams · {teams.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/screen/${game.code}`}
            target="_blank"
            className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
          >
            Big screen ↗
          </Link>
          <Link
            href="/host/dashboard"
            className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* ---- Main area: board OR question ---- */}
        <div className="px-6 py-6 border-r border-stone-200">
          {!currentQuestion ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  The board
                </p>
                <button
                  onClick={async () => {
                    await callApi('toggle_leaderboard', {
                      show: !gameState?.show_leaderboard,
                    });
                  }}
                  className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
                >
                  {gameState?.show_leaderboard
                    ? 'Hide leaderboard'
                    : 'Show leaderboard'}
                </button>
              </div>

              <div className="grid grid-cols-5 gap-px bg-stone-200 border border-stone-200">
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-ink text-paper p-4">
                    <p className="font-serif italic text-sm leading-tight">
                      {cat.name}
                    </p>
                  </div>
                ))}
                {[100, 200, 300, 400, 500].flatMap((points) =>
                  categories.map((cat) => {
                    const q = cat.questions.find((q) => q.points === points);
                    if (!q)
                      return (
                        <div
                          key={`${cat.id}-${points}`}
                          className="bg-stone-100 p-6"
                        />
                      );
                    return (
                      <button
                        key={q.id}
                        disabled={q.is_answered}
                        onClick={() => selectQuestion(q)}
                        className={`p-6 text-center transition-colors ${
                          q.is_answered
                            ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                            : 'bg-paper hover:bg-ink hover:text-paper'
                        }`}
                      >
                        <span className="font-serif text-2xl">
                          {q.is_answered ? '—' : q.points}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={backToBoard}
                  className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
                >
                  ← Back to board
                </button>
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  {currentQuestion.points} pts · {currentQuestion.type}
                </p>
              </div>

              <div className="mb-8">
                <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight mb-6">
                  {currentQuestion.prompt}
                </h2>

                {currentQuestion.audio_url && (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                      Audio cue
                    </p>
                    <audio controls src={currentQuestion.audio_url} className="w-full" />
                  </div>
                )}

                {currentQuestion.host_note && (
                  <div className="bg-stone-100 p-4 mb-4">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                      Host note
                    </p>
                    <p className="text-sm text-stone-700">
                      {currentQuestion.host_note}
                    </p>
                  </div>
                )}

                <div className="border-t border-ink pt-4 mt-6">
                  <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                    Correct answer
                  </p>
                  <p className="font-serif italic text-2xl">
                    {currentQuestion.answer}
                  </p>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap gap-3 mb-8 pb-8 border-b border-stone-200">
                <Button
                  variant={gameState?.answers_open ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    callApi('set_answers_open', {
                      open: !gameState?.answers_open,
                    })
                  }
                >
                  {gameState?.answers_open ? 'Lock answers' : 'Open answers'}
                </Button>
                <Button
                  variant={gameState?.answer_revealed ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    callApi('set_revealed', {
                      revealed: !gameState?.answer_revealed,
                    })
                  }
                >
                  {gameState?.answer_revealed ? 'Hide answer' : 'Reveal answer'}
                </Button>
                <Button
                  variant={currentQuestion.is_answered ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => markAnswered(!currentQuestion.is_answered)}
                >
                  {currentQuestion.is_answered ? 'Reopen field' : 'Mark used'}
                </Button>
              </div>

              {/* Submissions + scoring */}
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
                  Submissions ({submissions.length})
                </p>
                {submissions.length === 0 ? (
                  <p className="text-stone-500 text-sm">No answers yet.</p>
                ) : (
                  <ul className="space-y-px">
                    {submissions.map((s) => {
                      const team = teams.find((t) => t.id === s.team_id);
                      return (
                        <li
                          key={s.id}
                          className="flex items-center justify-between py-3 border-b border-stone-200"
                        >
                          <div className="flex-1">
                            <p className="text-xs uppercase tracking-widest text-stone-500">
                              {team?.name || 'Unknown team'}
                            </p>
                            <p className="font-serif italic text-lg">
                              &ldquo;{s.answer_text}&rdquo;
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                awardPoints(s.team_id, currentQuestion.points)
                              }
                              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90"
                            >
                              +{currentQuestion.points}
                            </button>
                            <button
                              onClick={() =>
                                awardPoints(s.team_id, -currentQuestion.points)
                              }
                              className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest hover:border-ink"
                            >
                              −{currentQuestion.points}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Manual award for teams that didn't submit */}
                {currentQuestion && (
                  <div className="mt-8">
                    <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                      Award without submission
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {teams
                        .filter(
                          (t) => !submissions.find((s) => s.team_id === t.id)
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() =>
                              awardPoints(t.id, currentQuestion.points)
                            }
                            className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest hover:border-ink"
                          >
                            {t.name} +{currentQuestion.points}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- Sidebar: leaderboard ---- */}
        <aside className="px-6 py-6 bg-stone-50">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
            Leaderboard
          </p>
          {teams.length === 0 ? (
            <p className="text-stone-500 text-sm">Waiting for teams to join.</p>
          ) : (
            <ul className="space-y-px">
              {teams.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 border-b border-stone-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest text-stone-400 w-6">
                      {i + 1}
                    </span>
                    <span className="text-sm">{t.name}</span>
                  </div>
                  <span className="font-serif italic text-lg">{t.score}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
