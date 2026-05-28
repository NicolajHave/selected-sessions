'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  type QuestionWager,
  type IntroSubmission,
} from '@/lib/supabase/client';
import { INTRO_QUESTION } from '@/lib/quiz/intro-question';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/shared/Button';
import { getGuessTheArtistEntry } from '@/lib/quiz/guess-the-artist';
import {
  getSelectedBangersEntry,
  segmentDuration,
} from '@/lib/quiz/selected-bangers';
import {
  getSelectedOrRejectedEntry,
  sorSegmentDuration,
  type SorChoice,
} from '@/lib/quiz/selected-or-rejected';
import {
  getFinishTheOutfitEntry,
  ftoSegmentDuration,
} from '@/lib/quiz/finish-the-outfit';
import {
  getArchiveSoundsEntry,
  asAudioToClip,
} from '@/lib/quiz/archive-sounds';

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
  const [hintTeamId, setHintTeamId] = useState<string>('');
  const [waitingMuted, setWaitingMuted] = useState(false);
  const [wagers, setWagers] = useState<QuestionWager[]>([]);
  const [introSubs, setIntroSubs] = useState<IntroSubmission[]>([]);
  const [introNow, setIntroNow] = useState(Date.now());

  // Auto-close timer for Selected Bangers questions with autoCloseOnEnd.
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

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

  const reloadWagers = useCallback(async (questionId: string | null) => {
    if (!questionId) {
      setWagers([]);
      return;
    }
    const { data } = await supabase
      .from('question_wagers')
      .select('*')
      .eq('question_id', questionId);
    setWagers(data || []);
  }, []);

  const reloadIntroSubs = useCallback(async (gameId: string) => {
    const { data } = await supabase
      .from('intro_submissions')
      .select('*')
      .eq('game_id', gameId)
      .order('submitted_at');
    setIntroSubs((data as IntroSubmission[]) || []);
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
        await reloadWagers(stateData.current_question_id);
      }
      await reloadIntroSubs(gameData.id);

      setLoading(false);
    }

    init();
  }, [
    code,
    reloadQuestions,
    reloadTeams,
    reloadSubmissions,
    reloadWagers,
    reloadIntroSubs,
    loadCurrentQuestion,
  ]);

  // Realtime: intro submissions (Fastest Fit First).
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`intro_subs:${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'intro_submissions',
          filter: `game_id=eq.${game.id}`,
        },
        () => reloadIntroSubs(game.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, reloadIntroSubs]);

  // Live "now" tick while intro is running so the countdown updates.
  useEffect(() => {
    if (!gameState?.intro_mode_active || gameState?.intro_revealed) return;
    const id = setInterval(() => setIntroNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameState?.intro_mode_active, gameState?.intro_revealed]);

  // ---- Realtime: wagers for current question (CHANCEN) ----
  useEffect(() => {
    if (!gameState?.current_question_id) return;
    const qid = gameState.current_question_id;
    const channel = supabase
      .channel(`wagers:${qid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_wagers',
          filter: `question_id=eq.${qid}`,
        },
        () => reloadWagers(qid)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameState?.current_question_id, reloadWagers]);

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

  // Clear any pending auto-close timer on unmount.
  useEffect(() => clearAutoCloseTimer, [clearAutoCloseTimer]);

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
    clearAutoCloseTimer();
    setHintTeamId('');
    await callApi('select_question', { question_id: q.id });
    await loadCurrentQuestion(q.id);
    await reloadSubmissions(q.id);
    await reloadWagers(q.id);

    // Audio questions with autoCloseOnEnd: open answers immediately and schedule
    // an auto-close when the question clip ends (matches Big Screen playback).
    const cat = categories.find((c) => c.id === q.category_id);
    const sb = getSelectedBangersEntry(cat?.name, q.points);
    const sor = getSelectedOrRejectedEntry(cat?.name, q.points);
    const fto = getFinishTheOutfitEntry(cat?.name, q.points);

    // Two-round questions (Q200) start at round 0.
    if (sor?.type === 'tworound') {
      await enterRound(0, q);
      return;
    }

    // Finish the (Out)fit: song plays with answers CLOSED, then answers open
    // automatically at the hard stop (end of the question clip).
    if (fto) {
      const seconds = ftoSegmentDuration(fto.questionAudio);
      autoCloseTimerRef.current = setTimeout(() => {
        callApi('set_answers_open', { open: true });
        autoCloseTimerRef.current = null;
      }, seconds * 1000);
      return;
    }

    let autoCloseSeconds = 0;
    if (sb?.questionAudio?.autoCloseOnEnd) {
      autoCloseSeconds = segmentDuration(sb.questionAudio);
    } else if (sor?.questionAudio?.autoCloseOnEnd) {
      autoCloseSeconds = sorSegmentDuration(sor.questionAudio);
    }
    if (autoCloseSeconds > 0) {
      await callApi('set_answers_open', { open: true });
      autoCloseTimerRef.current = setTimeout(() => {
        callApi('set_answers_open', { open: false });
        autoCloseTimerRef.current = null;
      }, autoCloseSeconds * 1000);
    }
  }

  // Q200: switch to a round, play its audio on the Big Screen, and auto-close
  // answers when that round's clip ends.
  async function enterRound(roundIndex: number, q?: Question) {
    const question = q ?? currentQuestion;
    if (!game || !question) return;
    const cat = categories.find((c) => c.id === question.category_id);
    const sor = getSelectedOrRejectedEntry(cat?.name, question.points);
    const round = sor?.rounds?.[roundIndex];
    clearAutoCloseTimer();
    await callApi('set_round', { round: roundIndex });
    if (round?.questionAudio?.autoCloseOnEnd) {
      const seconds = sorSegmentDuration(round.questionAudio);
      autoCloseTimerRef.current = setTimeout(() => {
        callApi('set_answers_open', { open: false });
        autoCloseTimerRef.current = null;
      }, seconds * 1000);
    }
  }

  async function setWinningAnswer(winner: SorChoice) {
    if (!game || !currentQuestion) return;
    await callApi('set_winning_answer', {
      winner,
      question_id: currentQuestion.id,
    });
    await reloadTeams(game.id);
  }

  async function backToBoard() {
    clearAutoCloseTimer();
    setHintTeamId('');
    await callApi('back_to_board');
    setCurrentQuestion(null);
    setSubmissions([]);
    setWagers([]);
  }

  async function buyHint(teamId: string, cost: number) {
    if (!game || !currentQuestion || !teamId) return;
    const res = await fetch(`/api/games/${game.code}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buy_hint',
        team_id: teamId,
        question_id: currentQuestion.id,
        cost,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Buy hint failed:', err);
      return;
    }
    await reloadTeams(game.id);
  }

  async function awardPoints(teamId: string, points: number) {
    if (!currentQuestion) return;
    await callApi('award_points', {
      team_id: teamId,
      points,
      question_id: currentQuestion.id,
    });
  }

  // Broadcasts a transient "stop audio" command to the Big Screen.
  // No DB write — uses Supabase Realtime broadcast on a per-game channel.
  async function stopBigScreenAudio() {
    if (!game) return;
    const channel = supabase.channel(`audio_control:${game.id}`);
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event: 'stop_audio', payload: {} });
    // Tear down right away — broadcast doesn't need to persist.
    setTimeout(() => supabase.removeChannel(channel), 300);
  }

  // Triggers a short audio cue on the Big Screen (Archive Sounds Q100).
  async function playCue(spec: {
    src: string;
    startAt: number;
    duration: number;
    fadeOut?: number;
  }) {
    if (!game) return;
    const channel = supabase.channel(`audio_control:${game.id}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'play_cue',
      payload: spec,
    });
    setTimeout(() => supabase.removeChannel(channel), 300);
  }

  // Mute / unmute the Big Screen waiting-room music (transient broadcast).
  async function setWaitingMute(muted: boolean) {
    if (!game) return;
    setWaitingMuted(muted);
    const channel = supabase.channel(`audio_control:${game.id}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'toggle_waiting_mute',
      payload: { muted },
    });
    setTimeout(() => supabase.removeChannel(channel), 300);
  }

  async function resetGame() {
    if (!game) return;
    const ok = window.confirm(
      'Reset the session?\n\nThis will:\n• Remove every team and their answers\n• Re-open every question on the board\n• Clear current question, reveal and leaderboard\n\nThe game code stays the same so players can rejoin.',
    );
    if (!ok) return;

    const res = await fetch(`/api/games/${game.code}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_game' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Reset failed:', err);
      window.alert('Reset failed. Check the console.');
      return;
    }

    const updated = await res.json();
    if (updated.gameState) setGameState(updated.gameState);
    setCurrentQuestion(null);
    setSubmissions([]);
    await reloadQuestions(game.id);
    await reloadTeams(game.id);
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
                  const submittedBy = new Set(introSubs.map((s) => s.team_id));
                  const revealed = !!gameState.intro_revealed;
                  const ranked = revealed
                    ? [...introSubs]
                        .map((s) => ({
                          sub: s,
                          team: teams.find((t) => t.id === s.team_id),
                        }))
                        .sort((a, b) => {
                          const ac = !!a.sub.is_correct;
                          const bc = !!b.sub.is_correct;
                          if (ac && !bc) return -1;
                          if (bc && !ac) return 1;
                          return (
                            (a.sub.submit_ms ?? 1e12) -
                            (b.sub.submit_ms ?? 1e12)
                          );
                        })
                    : [];
                  const noSub = revealed
                    ? teams.filter((t) => !submittedBy.has(t.id))
                    : [];
                  const winnerTeam = teams.find(
                    (t) => t.id === gameState.intro_winning_team_id,
                  );
                  return (
                    <div>
                      <div className="mb-6">
                        <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-1">
                          Intro question
                        </p>
                        <h2 className="font-serif text-3xl tracking-tight">
                          {INTRO_QUESTION.title}
                        </h2>
                        <p className="text-stone-600 mt-2">
                          {INTRO_QUESTION.prompt}
                        </p>
                      </div>

                      {!revealed && (
                        <>
                          <div className="mb-6 flex items-baseline gap-6">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-stone-500">
                                Time
                              </p>
                              <p className="font-serif text-5xl">
                                {Math.ceil(remaining)}s
                              </p>
                            </div>
                            <div className="flex-1 h-1 bg-stone-200">
                              <div
                                className="h-1 bg-ink transition-[width] duration-300 ease-linear"
                                style={{
                                  width: `${(remaining / INTRO_QUESTION.timerSeconds) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                            Submissions ({submittedBy.size}/{teams.length})
                          </p>
                          <ul className="mb-6 space-y-px">
                            {teams.map((t) => (
                              <li
                                key={t.id}
                                className="flex justify-between text-sm py-2 border-b border-stone-100"
                              >
                                <span>{t.name}</span>
                                <span
                                  className={
                                    submittedBy.has(t.id)
                                      ? 'uppercase tracking-widest text-xs text-ink'
                                      : 'uppercase tracking-widest text-xs text-stone-400'
                                  }
                                >
                                  {submittedBy.has(t.id) ? 'Locked' : 'Waiting'}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => callApi('reveal_intro')}
                            >
                              Reveal intro results
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Cancel the intro question? All submissions are cleared.',
                                  )
                                )
                                  callApi('cancel_intro');
                              }}
                            >
                              Cancel intro question
                            </Button>
                          </div>
                        </>
                      )}

                      {revealed && (
                        <>
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                            Results
                          </p>
                          <ul className="mb-6 space-y-px">
                            {ranked.map(({ sub, team }, i) => (
                              <li
                                key={sub.id}
                                className="flex justify-between text-sm py-2 border-b border-stone-100"
                              >
                                <span>
                                  {i + 1}. {team?.name ?? '—'}
                                </span>
                                <span
                                  className={
                                    sub.is_correct
                                      ? 'uppercase tracking-widest text-xs text-ink'
                                      : 'uppercase tracking-widest text-xs text-stone-400'
                                  }
                                >
                                  {sub.is_correct ? 'Correct' : 'Incorrect'} ·{' '}
                                  {sub.submit_ms != null
                                    ? (sub.submit_ms / 1000).toFixed(1)
                                    : '—'}
                                  s
                                </span>
                              </li>
                            ))}
                            {noSub.map((t) => (
                              <li
                                key={t.id}
                                className="flex justify-between text-sm py-2 border-b border-stone-100 text-stone-400"
                              >
                                <span>{t.name}</span>
                                <span className="uppercase tracking-widest text-xs">
                                  No submission
                                </span>
                              </li>
                            ))}
                          </ul>

                          {winnerTeam ? (
                            <p className="font-serif italic text-2xl mb-6">
                              {winnerTeam.name} starts the session.
                            </p>
                          ) : (
                            <div className="mb-6">
                              <p className="text-stone-600 mb-3">
                                No exact match — pick the starting team:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {teams.map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() =>
                                      callApi('set_starting_team', {
                                        team_id: t.id,
                                      })
                                    }
                                    className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest hover:border-ink"
                                  >
                                    {t.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            size="sm"
                            onClick={() => callApi('end_intro')}
                          >
                            Go to board
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })()
              ) : (
                <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs uppercase tracking-widest text-stone-500">
                  The board
                </p>
                <div className="flex items-center gap-5">
                  {gameState?.show_join && (
                    <button
                      onClick={() => setWaitingMute(!waitingMuted)}
                      className="text-xs uppercase tracking-widest text-stone-500 hover:text-ink transition-colors"
                    >
                      {waitingMuted ? 'Unmute music' : 'Mute music'}
                    </button>
                  )}
                  <button
                    onClick={() => callApi('start_intro')}
                    className="text-xs uppercase tracking-widest text-clay hover:opacity-80 transition-colors"
                  >
                    Start intro question
                  </button>
                  <button
                    onClick={async () => {
                      await callApi('toggle_join', {
                        show: !gameState?.show_join,
                      });
                    }}
                    className={`text-xs uppercase tracking-widest transition-colors ${
                      gameState?.show_join
                        ? 'text-clay hover:opacity-80'
                        : 'text-stone-500 hover:text-ink'
                    }`}
                  >
                    {gameState?.show_join ? 'Hide join QR' : 'Show join QR'}
                  </button>
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
                </>
              )}
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

              {(() => {
                const cat = categories.find(
                  (c) => c.id === currentQuestion.category_id,
                );
                const gta = getGuessTheArtistEntry(
                  cat?.name,
                  currentQuestion.points,
                );
                const sb = getSelectedBangersEntry(
                  cat?.name,
                  currentQuestion.points,
                );
                const sor = getSelectedOrRejectedEntry(
                  cat?.name,
                  currentQuestion.points,
                );
                const fto = getFinishTheOutfitEntry(
                  cat?.name,
                  currentQuestion.points,
                );
                const as = getArchiveSoundsEntry(
                  cat?.name,
                  currentQuestion.points,
                );
                const isRich = !!gta || !!sb || !!sor || !!fto || !!as;
                const displayTitle =
                  sb?.title ?? sor?.title ?? fto?.title ?? as?.title;
                const displayPrompt =
                  gta?.prompt ??
                  sb?.prompt ??
                  sor?.prompt ??
                  fto?.prompt ??
                  as?.prompt ??
                  currentQuestion.prompt;
                const displayAnswer =
                  fto != null
                    ? fto.correctAnswer || '(host-scored — see team answers)'
                    : (gta?.answer ??
                      sb?.answer ??
                      sor?.correct ??
                      as?.answer ??
                      currentQuestion.answer);
                const hasOpenAudio =
                  !!gta?.openAudio ||
                  !!sb?.questionAudio ||
                  !!sor?.questionAudio ||
                  !!fto ||
                  !!as?.questionAudio ||
                  !!as?.questionVideo;

                return (
                  <>
                    <div className="mb-8">
                      {displayTitle && (
                        <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-2">
                          {displayTitle}
                        </p>
                      )}
                      <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight mb-6">
                        {displayPrompt}
                      </h2>

                      {sb?.trackInfo && (
                        <p className="font-serif italic text-xl text-stone-600 mb-4">
                          {sb.trackInfo}
                        </p>
                      )}

                      {/* Rich categories: audio plays on Big Screen only. */}
                      {isRich ? (
                        <div className="bg-stone-100 p-4 mb-4">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Big screen behavior
                          </p>
                          <p className="text-sm text-stone-700">
                            {sb
                              ? sb.questionAudio?.autoCloseOnEnd
                                ? 'Audio plays automatically on the Big Screen and answers auto-close when the clip ends. Use "Stop audio" to cut it short.'
                                : 'Audio plays automatically on the Big Screen when you select this question.'
                              : hasOpenAudio
                                ? 'Audio plays automatically on the Big Screen when you select this question. Use "Stop audio" below to cut it short.'
                                : gta?.type === 'image'
                                  ? 'Image shown on the Big Screen. Reveal will swap to the second image and play a short clip.'
                                  : 'Text-only on open. Reveal will play a short clip on the Big Screen.'}
                          </p>
                        </div>
                      ) : (
                        currentQuestion.audio_url && (
                          <div className="mb-4">
                            <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                              Audio cue
                            </p>
                            <audio
                              controls
                              src={currentQuestion.audio_url}
                              className="w-full"
                            />
                          </div>
                        )
                      )}

                      {sb?.acceptedGuidance && (
                        <div className="bg-clay/10 border border-clay/30 p-4 mb-4">
                          <p className="text-xs uppercase tracking-widest text-clay mb-1">
                            Accepted answer
                          </p>
                          <p className="text-sm text-stone-700">
                            {sb.acceptedGuidance}
                          </p>
                        </div>
                      )}

                      {currentQuestion.host_note && !isRich && (
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
                          {displayAnswer}
                        </p>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex flex-wrap gap-3 mb-8 pb-8 border-b border-stone-200">
                      <Button
                        variant={
                          gameState?.answers_open ? 'primary' : 'secondary'
                        }
                        size="sm"
                        onClick={() =>
                          callApi('set_answers_open', {
                            open: !gameState?.answers_open,
                          })
                        }
                      >
                        {gameState?.answers_open
                          ? 'Lock answers'
                          : 'Open answers'}
                      </Button>
                      <Button
                        variant={
                          gameState?.answer_revealed ? 'primary' : 'secondary'
                        }
                        size="sm"
                        onClick={() => {
                          const revealing = !gameState?.answer_revealed;
                          if (
                            revealing &&
                            !window.confirm(
                              'Reveal the answer on the Big Screen now?',
                            )
                          ) {
                            return;
                          }
                          callApi('set_revealed', { revealed: revealing });
                        }}
                      >
                        {gameState?.answer_revealed
                          ? 'Hide answer'
                          : 'Reveal answer'}
                      </Button>
                      {hasOpenAudio && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={stopBigScreenAudio}
                        >
                          Stop audio
                        </Button>
                      )}
                      <Button
                        variant={
                          currentQuestion.is_answered ? 'primary' : 'secondary'
                        }
                        size="sm"
                        onClick={() =>
                          markAnswered(!currentQuestion.is_answered)
                        }
                      >
                        {currentQuestion.is_answered
                          ? 'Reopen field'
                          : 'Mark used'}
                      </Button>
                    </div>
                  </>
                );
              })()}

              {/* Submissions + scoring — manual, OR auto panel for Selected or Rejected */}
              {(() => {
                const sorCat = categories.find(
                  (c) => c.id === currentQuestion.category_id,
                );
                const asCur = getArchiveSoundsEntry(
                  sorCat?.name,
                  currentQuestion.points,
                );
                if (asCur) {
                  // Group submissions by team (one main answer per team).
                  const ansByTeam = new Map<string, string>();
                  for (const s of submissions) {
                    if (!ansByTeam.has(s.team_id)) {
                      ansByTeam.set(s.team_id, s.answer_text);
                    }
                  }
                  return (
                    <div>
                      {asCur.acceptedGuidance && (
                        <div className="bg-clay/10 border border-clay/30 p-4 mb-4">
                          <p className="text-xs uppercase tracking-widest text-clay mb-1">
                            Accepted answer
                          </p>
                          <p className="text-sm text-stone-700">
                            {asCur.acceptedGuidance}
                          </p>
                        </div>
                      )}

                      {/* Q100: manually-triggered 1-second audio cue */}
                      {asCur.questionAudio?.manuallyTriggered && (
                        <div className="border border-stone-200 p-4 mb-6">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                            Audio cue
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Plays a 1-second snippet on the Big Screen — use
                            this in place of the usual auto-play.
                          </p>
                          <Button
                            size="sm"
                            onClick={() =>
                              playCue(asAudioToClip(asCur.questionAudio!))
                            }
                          >
                            Play 1-second cue
                          </Button>
                        </div>
                      )}

                      <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                        Answers ({ansByTeam.size}/{teams.length})
                      </p>
                      <p className="text-xs text-stone-500 mb-4">
                        Host-scored. Click Correct to award {asCur.points}.
                      </p>
                      {ansByTeam.size === 0 ? (
                        <p className="text-stone-500 text-sm">
                          No answers yet.
                        </p>
                      ) : (
                        <ul className="space-y-px">
                          {teams
                            .filter((t) => ansByTeam.has(t.id))
                            .map((t) => (
                              <li
                                key={t.id}
                                className="flex items-center justify-between py-3 border-b border-stone-200"
                              >
                                <div className="flex-1 pr-3">
                                  <p className="text-xs uppercase tracking-widest text-stone-500">
                                    {t.name}
                                  </p>
                                  <p className="font-serif italic text-lg">
                                    &ldquo;{ansByTeam.get(t.id)}&rdquo;
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      awardPoints(t.id, asCur.points)
                                    }
                                    className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90"
                                  >
                                    Correct +{asCur.points}
                                  </button>
                                  <button
                                    onClick={() =>
                                      awardPoints(t.id, -asCur.points)
                                    }
                                    className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest hover:border-ink"
                                  >
                                    −{asCur.points}
                                  </button>
                                </div>
                              </li>
                            ))}
                        </ul>
                      )}

                      {/* Q500: paid image hint */}
                      {asCur.hint && (
                        <div className="mt-8 pt-6 border-t border-stone-200">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Paid hint (−{asCur.hint.cost})
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Subtracts {asCur.hint.cost} and shows the hint
                            image on that team&rsquo;s own screen.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={hintTeamId}
                              onChange={(e) => setHintTeamId(e.target.value)}
                              className="border border-stone-300 px-3 py-2 text-sm bg-white"
                            >
                              <option value="">Select a team…</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={!hintTeamId}
                              onClick={() =>
                                buyHint(hintTeamId, asCur.hint!.cost)
                              }
                              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-30"
                            >
                              Buy hint (−{asCur.hint.cost})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const ftoCur = getFinishTheOutfitEntry(
                  sorCat?.name,
                  currentQuestion.points,
                );
                if (ftoCur) {
                  // Group submissions: one main lyric row + optional bonus row per team.
                  const lyricByTeam = new Map<string, string>();
                  const bonusByTeam = new Map<string, string>();
                  for (const s of submissions) {
                    const p = s.answer_payload as {
                      lyricAnswer?: string;
                      bonusAnswer?: string;
                    };
                    if (p?.bonusAnswer) bonusByTeam.set(s.team_id, p.bonusAnswer);
                    else lyricByTeam.set(s.team_id, p?.lyricAnswer ?? s.answer_text);
                  }
                  const answeredTeams = teams.filter((t) =>
                    lyricByTeam.has(t.id),
                  );
                  return (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                        Lyric answers ({answeredTeams.length}/{teams.length})
                      </p>
                      <p className="text-xs text-stone-500 mb-4">
                        Host-scored. Click Correct to award {ftoCur.points}.
                      </p>
                      {answeredTeams.length === 0 ? (
                        <p className="text-stone-500 text-sm">
                          No answers yet — answers open when the song stops.
                        </p>
                      ) : (
                        <ul className="space-y-px">
                          {answeredTeams.map((t) => (
                            <li
                              key={t.id}
                              className="flex items-center justify-between py-3 border-b border-stone-200"
                            >
                              <div className="flex-1 pr-3">
                                <p className="text-xs uppercase tracking-widest text-stone-500">
                                  {t.name}
                                </p>
                                <p className="font-serif italic text-lg">
                                  &ldquo;{lyricByTeam.get(t.id)}&rdquo;
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    awardPoints(t.id, ftoCur.points)
                                  }
                                  className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90"
                                >
                                  Correct +{ftoCur.points}
                                </button>
                                <button
                                  onClick={() =>
                                    awardPoints(t.id, -ftoCur.points)
                                  }
                                  className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest hover:border-ink"
                                >
                                  −{ftoCur.points}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Q400 bonus status (auto-scored on reveal) */}
                      {ftoCur.bonus && (
                        <div className="mt-8 pt-6 border-t border-stone-200">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Bonus answers (auto-scored on reveal)
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Correct (“{ftoCur.bonus.correct}”) +
                            {ftoCur.bonus.correctPoints} · wrong{' '}
                            {ftoCur.bonus.wrongPoints}
                          </p>
                          <ul className="space-y-1">
                            {teams.map((t) => (
                              <li
                                key={t.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-stone-600">{t.name}</span>
                                <span className="font-serif italic">
                                  {bonusByTeam.get(t.id) ?? '—'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Q500 paid hint */}
                      {ftoCur.hint && (
                        <div className="mt-8 pt-6 border-t border-stone-200">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Paid hint (−{ftoCur.hint.cost})
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Subtracts {ftoCur.hint.cost} and reveals the hint on
                            that team&rsquo;s screen.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={hintTeamId}
                              onChange={(e) => setHintTeamId(e.target.value)}
                              className="border border-stone-300 px-3 py-2 text-sm bg-white"
                            >
                              <option value="">Select a team…</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={!hintTeamId}
                              onClick={() =>
                                buyHint(hintTeamId, ftoCur.hint!.cost)
                              }
                              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-30"
                            >
                              Buy hint (−{ftoCur.hint.cost})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const sorCur = getSelectedOrRejectedEntry(
                  sorCat?.name,
                  currentQuestion.points,
                );
                if (sorCur) {
                  const activeRound = gameState?.active_round ?? 0;
                  const roundCount = sorCur.rounds?.length ?? 0;
                  const counts: Record<string, number> = {
                    Selected: 0,
                    Rejected: 0,
                  };
                  for (const s of submissions) {
                    const p = s.answer_payload as {
                      answer?: string;
                      roundIndex?: number;
                    };
                    // For two-round questions only count the active round.
                    if (
                      sorCur.type === 'tworound' &&
                      p?.roundIndex !== activeRound
                    ) {
                      continue;
                    }
                    const v = p?.answer ?? s.answer_text;
                    if (v === 'Selected' || v === 'Rejected') counts[v] += 1;
                  }
                  return (
                    <div>
                      {sorCur.type === 'tworound' && (
                        <div className="border border-stone-200 p-4 mb-6">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
                            Two rounds · currently Round {activeRound + 1} of{' '}
                            {roundCount}
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Each correct round = 100. Reveal when both rounds are
                            done — scored automatically.
                          </p>
                          {activeRound < roundCount - 1 ? (
                            <Button
                              size="sm"
                              onClick={() => enterRound(activeRound + 1)}
                            >
                              Start Round {activeRound + 2}
                            </Button>
                          ) : (
                            <p className="text-xs uppercase tracking-widest text-stone-400">
                              Final round — reveal to score
                            </p>
                          )}
                        </div>
                      )}

                      {/* CHANCEN wager overview + start control */}
                      {sorCur.type === 'chance' && (
                        <div className="border border-stone-200 p-4 mb-6">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                            Wagers ({wagers.length}/{teams.length})
                          </p>
                          <ul className="space-y-1 mb-4">
                            {teams.map((t) => {
                              const w = wagers.find((x) => x.team_id === t.id);
                              return (
                                <li
                                  key={t.id}
                                  className="flex justify-between text-sm"
                                >
                                  <span className="text-stone-600">
                                    {t.name}
                                  </span>
                                  <span className="font-serif italic">
                                    {w ? w.wager_amount : '—'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {!gameState?.chance_started ? (
                            <Button
                              size="sm"
                              onClick={() => callApi('start_chance')}
                            >
                              Start Chance Question
                            </Button>
                          ) : (
                            <p className="text-xs uppercase tracking-widest text-stone-400">
                              Question started — reveal to score
                            </p>
                          )}
                        </div>
                      )}

                      {/* Multi-select: nothing to count, just a status note */}
                      {sorCur.type === 'multiselect' && (
                        <p className="text-sm text-stone-600 mb-6">
                          {submissions.length}/{teams.length} teams have
                          submitted their 3 songs. Scored automatically on
                          reveal (3=500, 2=300, 1=100).
                        </p>
                      )}

                      {/* Selected/Rejected counts (button-style questions) */}
                      {(sorCur.type === 'truefact' ||
                        sorCur.type === 'majority' ||
                        sorCur.type === 'tworound' ||
                        (sorCur.type === 'chance' &&
                          gameState?.chance_started)) && (
                        <>
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">
                            Live answers ({submissions.length})
                            {sorCur.type === 'tworound'
                              ? ` · Round ${activeRound + 1}`
                              : ''}
                          </p>
                          <div className="flex gap-4 mb-6">
                            <div className="flex-1 border border-stone-200 p-4 text-center">
                              <p className="text-xs uppercase tracking-widest text-stone-500">
                                Selected
                              </p>
                              <p className="font-serif text-4xl mt-1">
                                {counts.Selected}
                              </p>
                            </div>
                            <div className="flex-1 border border-stone-200 p-4 text-center">
                              <p className="text-xs uppercase tracking-widest text-stone-500">
                                Rejected
                              </p>
                              <p className="font-serif text-4xl mt-1">
                                {counts.Rejected}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                      <p className="text-sm text-stone-600 mb-6">
                        Scored automatically when you reveal the answer — no
                        manual awarding needed.
                      </p>
                      {sorCur.type === 'majority' && (
                        <div className="border-t border-stone-200 pt-4">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Tie-break (use only if the vote is tied)
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Picks the winning side and awards {sorCur.points} to
                            those teams.
                            {gameState?.winning_answer
                              ? ` Current winner: ${gameState.winning_answer}.`
                              : ''}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setWinningAnswer('Selected')}
                            >
                              Set Selected as winner
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setWinningAnswer('Rejected')}
                            >
                              Set Rejected as winner
                            </Button>
                          </div>
                        </div>
                      )}
                      {submissions.length > 0 && (
                        <ul className="mt-6 space-y-px">
                          {submissions.map((s) => {
                            const team = teams.find((t) => t.id === s.team_id);
                            const v =
                              (s.answer_payload as { answer?: string })
                                ?.answer ?? s.answer_text;
                            return (
                              <li
                                key={s.id}
                                className="flex items-center justify-between py-2 border-b border-stone-100 text-sm"
                              >
                                <span className="uppercase tracking-widest text-stone-500">
                                  {team?.name || 'Unknown'}
                                </span>
                                <span className="font-serif italic">{v}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                }
                return (
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

                {/* Selected Bangers extra mechanics: +50 bonus / paid hint */}
                {(() => {
                  const cat = categories.find(
                    (c) => c.id === currentQuestion.category_id,
                  );
                  const sb = getSelectedBangersEntry(
                    cat?.name,
                    currentQuestion.points,
                  );
                  if (!sb) return null;

                  return (
                    <>
                      {sb.bonus && (
                        <div className="mt-8 pt-6 border-t border-stone-200">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Bonus — {sb.bonus.label}
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Award only if a team names both song titles and both
                            artists.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {teams.map((t) => (
                              <button
                                key={t.id}
                                onClick={() =>
                                  awardPoints(t.id, sb.bonus!.points)
                                }
                                className="border border-clay/40 text-clay px-3 py-2 text-xs uppercase tracking-widest hover:bg-clay/10"
                              >
                                {t.name} +{sb.bonus!.points}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {sb.hint && (
                        <div className="mt-8 pt-6 border-t border-stone-200">
                          <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                            Paid hint (−{sb.hint.cost})
                          </p>
                          <p className="text-xs text-stone-500 mb-3">
                            Subtracts {sb.hint.cost} points and reveals the hint
                            image on that team&rsquo;s own screen.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={hintTeamId}
                              onChange={(e) => setHintTeamId(e.target.value)}
                              className="border border-stone-300 px-3 py-2 text-sm bg-white"
                            >
                              <option value="">Select a team…</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={!hintTeamId}
                              onClick={() =>
                                buyHint(hintTeamId, sb.hint!.cost)
                              }
                              className="bg-ink text-paper px-4 py-2 text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-30"
                            >
                              Buy hint (−{sb.hint.cost})
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ---- Sidebar: leaderboard ---- */}
        <aside className="px-6 py-6 bg-stone-50 flex flex-col">
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

          <div className="mt-auto pt-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3">
              Session
            </p>
            <button
              onClick={resetGame}
              className="w-full text-left text-xs uppercase tracking-widest text-clay border border-stone-300 hover:border-clay hover:bg-white px-4 py-3 transition-colors"
            >
              Reset session
            </button>
            <p className="mt-2 text-[11px] text-stone-500 leading-relaxed">
              Removes all teams, clears scores, re-opens every question. Game
              code stays the same.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
