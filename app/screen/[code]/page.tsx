'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  supabase,
  type Game,
  type GameState,
  type Category,
  type Question,
  type Team,
  type IntroSubmission,
} from '@/lib/supabase/client';
import { INTRO_QUESTION } from '@/lib/quiz/intro-question';
import { QRCodeSVG } from 'qrcode.react';
import { Logo } from '@/components/shared/Logo';
import { SelectedSessionsLoader } from '@/components/SelectedSessionsLoader';
import { useAudioClip } from '@/lib/audio/useAudioClip';
import {
  getGuessTheArtistEntry,
  type GuessTheArtistEntry,
} from '@/lib/quiz/guess-the-artist';
import {
  getSelectedBangersEntry,
  toClip as sbToClip,
  type SelectedBangersEntry,
} from '@/lib/quiz/selected-bangers';
import {
  getSelectedOrRejectedEntry,
  sorToClip,
  type SorEntry,
} from '@/lib/quiz/selected-or-rejected';
import {
  getFinishTheOutfitEntry,
  ftoToClip,
  type FtoEntry,
} from '@/lib/quiz/finish-the-outfit';
import {
  getArchiveSoundsEntry,
  asAudioToClip,
  asVideoDuration,
  type AsEntry,
  type AsVideoSegment,
} from '@/lib/quiz/archive-sounds';
import type { AudioClipSpec } from '@/lib/audio/types';

interface CategoryWithQuestions extends Category {
  questions: Question[];
}

/**
 * Reveals configured lyric lines one at a time. If `timings` is provided, lines
 * appear at those exact seconds (from audio start); otherwise they advance at
 * equal intervals across the clip (fallback for questions without timings).
 */
function LyricTicker({
  lines,
  durationSec,
  resetKey,
  timings,
  maskedTime,
  maskedAnswer,
}: {
  lines: string[];
  durationSec: number;
  resetKey: string;
  timings?: number[];
  maskedTime?: number;
  maskedAnswer?: string;
}) {
  const timed = !!timings && timings.length > 0;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timed) {
      setElapsed(0);
      const start = Date.now();
      const id = setInterval(() => {
        setElapsed((Date.now() - start) / 1000);
      }, 120);
      return () => clearInterval(id);
    }
    // Fallback: equal intervals.
    setIndex(0);
    if (lines.length <= 1) return;
    const step = Math.max(1500, (durationSec * 1000) / lines.length);
    const id = setInterval(() => {
      setIndex((i) => Math.min(lines.length - 1, i + 1));
    }, step);
    return () => clearInterval(id);
  }, [lines.length, durationSec, resetKey, timed]);

  if (timed) {
    // Masked answer takes over at maskedTime.
    if (maskedTime != null && elapsed >= maskedTime && maskedAnswer) {
      return (
        <p className="font-serif text-5xl md:text-7xl tracking-[0.15em] text-stone-500 ss-chancen-in">
          {maskedAnswer}
        </p>
      );
    }
    // Highest line index whose timestamp has been reached; nothing shown before.
    let cur = -1;
    for (let i = 0; i < timings!.length; i++) {
      if (elapsed >= timings![i]) cur = i;
    }
    if (cur < 0) {
      return <p className="font-serif text-5xl md:text-7xl">&nbsp;</p>;
    }
    // Word-by-word reveal across the time available until the next line
    // (or the masked answer / clip end for the final line).
    const lineStart = timings![cur];
    const nextStart =
      cur + 1 < timings!.length
        ? timings![cur + 1]
        : (maskedTime ?? (durationSec > lineStart ? durationSec : lineStart + 4));
    const available = Math.max(0.5, nextStart - lineStart);
    const revealWindow = available * 0.8; // last 20% keeps the full line visible
    const words = lines[cur].split(' ');
    const elapsedInLine = Math.max(0, elapsed - lineStart);
    const frac = revealWindow > 0 ? Math.min(1, elapsedInLine / revealWindow) : 1;
    const wordsToShow = Math.max(1, Math.round(frac * words.length));
    return (
      <p
        key={cur}
        className="font-serif text-5xl md:text-7xl leading-tight"
      >
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              opacity: i < wordsToShow ? 1 : 0,
              transition: 'opacity 450ms ease',
            }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    );
  }

  return (
    <p
      key={index}
      className="font-serif text-5xl md:text-7xl leading-tight ss-chancen-in"
    >
      {lines[index]}
    </p>
  );
}

/**
 * Plays a slice of a video file from `startTime` for `durationSec`. Supports
 * an optional opacity fade (and audio volume fade) over the final `fadeOutSec`
 * seconds. Used by Archive Sounds for background and reveal videos.
 */
function VideoSegment({
  src,
  startTime,
  durationSec,
  baseOpacity = 1,
  fadeOutSec = 0,
  fadeToOpacity = null,
  includeAudio = true,
  className = '',
}: {
  src: string;
  startTime: number;
  durationSec: number;
  baseOpacity?: number;
  fadeOutSec?: number;
  fadeToOpacity?: number | null;
  includeAudio?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(baseOpacity);

  useEffect(() => {
    setOpacity(baseOpacity);
    const v = ref.current;
    if (!v) return;
    v.muted = !includeAudio;
    v.volume = 1;

    let stopT: ReturnType<typeof setTimeout> | null = null;
    let fadeT: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      try {
        v.currentTime = startTime;
      } catch {
        /* ignore */
      }
      v.play().catch(() => {
        /* autoplay may be blocked until user interacts */
      });

      if (fadeOutSec > 0) {
        const fadeStartMs = Math.max(0, (durationSec - fadeOutSec) * 1000);
        stopT = setTimeout(() => {
          const steps = 20;
          const stepMs = (fadeOutSec * 1000) / steps;
          const startVol = v.volume;
          const targetOp = fadeToOpacity ?? baseOpacity;
          let i = 0;
          fadeT = setInterval(() => {
            i += 1;
            v.volume = Math.max(0, startVol * (1 - i / steps));
            setOpacity(baseOpacity + (targetOp - baseOpacity) * (i / steps));
            if (i >= steps) {
              if (fadeT) clearInterval(fadeT);
              fadeT = null;
              try {
                v.pause();
              } catch {
                /* noop */
              }
            }
          }, stepMs);
        }, fadeStartMs);
      } else {
        stopT = setTimeout(
          () => {
            try {
              v.pause();
            } catch {
              /* noop */
            }
          },
          durationSec * 1000,
        );
      }
    };

    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });

    return () => {
      if (stopT) clearTimeout(stopT);
      if (fadeT) clearInterval(fadeT);
      try {
        v.pause();
      } catch {
        /* noop */
      }
    };
  }, [src, startTime, durationSec, baseOpacity, fadeOutSec, fadeToOpacity, includeAudio]);

  return (
    <video
      ref={ref}
      src={encodeURI(src)}
      className={className}
      style={{ opacity }}
      playsInline
    />
  );
}

/** Types a string out, character by character. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = setInterval(() => {
      setN((x) => {
        if (x >= text.length) {
          clearInterval(id);
          return x;
        }
        return x + 1;
      });
    }, 55);
    return () => clearInterval(id);
  }, [text]);
  return <span>{text.slice(0, n)}</span>;
}

export default function ScreenPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [categories, setCategories] = useState<CategoryWithQuestions[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [origin, setOrigin] = useState('');
  const [wagers, setWagers] = useState<
    { team_id: string; wager_amount: number }[]
  >([]);
  const [introSubs, setIntroSubs] = useState<IntroSubmission[]>([]);
  const [introNow, setIntroNow] = useState(Date.now());

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const { play, stop, primeAudio } = useAudioClip();
  // Separate player instance for looping waiting-room music (independent of
  // question audio so the two never fight over a single <audio> element).
  const { play: playWaiting, stop: stopWaiting } = useAudioClip();
  const [waitingMuted, setWaitingMuted] = useState(false);

  const WAITING_MUSIC = '/audio/selected-or-rejected/lost-coconut-rise-again.mp3';

  const currentCategoryName = useMemo(() => {
    if (!currentQuestion) return undefined;
    return categories.find((c) => c.id === currentQuestion.category_id)?.name;
  }, [currentQuestion, categories]);

  // Look up rich metadata for the current question (or null if N/A).
  const gtaEntry: GuessTheArtistEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    return getGuessTheArtistEntry(currentCategoryName, currentQuestion.points);
  }, [currentQuestion, currentCategoryName]);

  const sbEntry: SelectedBangersEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    return getSelectedBangersEntry(currentCategoryName, currentQuestion.points);
  }, [currentQuestion, currentCategoryName]);

  const sorEntry: SorEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    return getSelectedOrRejectedEntry(
      currentCategoryName,
      currentQuestion.points,
    );
  }, [currentQuestion, currentCategoryName]);

  const ftoEntry: FtoEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    return getFinishTheOutfitEntry(currentCategoryName, currentQuestion.points);
  }, [currentQuestion, currentCategoryName]);

  const asEntry: AsEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    return getArchiveSoundsEntry(currentCategoryName, currentQuestion.points);
  }, [currentQuestion, currentCategoryName]);

  const activeRound = gameState?.active_round ?? 0;

  // For two-round questions the audio comes from the active round.
  const sorRound =
    sorEntry?.type === 'tworound' && sorEntry.rounds
      ? (sorEntry.rounds[activeRound] ?? sorEntry.rounds[0])
      : null;

  // Unified audio clips across all rich categories.
  const openClip: AudioClipSpec | undefined = useMemo(() => {
    if (gtaEntry?.openAudio) return gtaEntry.openAudio;
    if (sbEntry?.questionAudio) return sbToClip(sbEntry.questionAudio);
    if (sorRound?.questionAudio) return sorToClip(sorRound.questionAudio);
    if (sorEntry?.questionAudio) return sorToClip(sorEntry.questionAudio);
    if (ftoEntry?.questionAudio) return ftoToClip(ftoEntry.questionAudio);
    // Archive Sounds: skip if manually triggered (host fires a cue) or if a
    // video provides the audio track.
    if (
      asEntry?.questionAudio &&
      !asEntry.questionAudio.manuallyTriggered &&
      asEntry.questionAudio.autoPlayOnOpen !== false &&
      !asEntry.questionVideo
    ) {
      return asAudioToClip(asEntry.questionAudio);
    }
    return undefined;
  }, [gtaEntry, sbEntry, sorEntry, sorRound, ftoEntry, asEntry]);

  const revealClip: AudioClipSpec | undefined = useMemo(() => {
    if (gtaEntry?.revealAudio) return gtaEntry.revealAudio;
    if (sbEntry?.revealAudio) return sbToClip(sbEntry.revealAudio);
    if (sorRound?.revealAudio) return sorToClip(sorRound.revealAudio);
    if (sorEntry?.revealAudio) return sorToClip(sorEntry.revealAudio);
    if (ftoEntry?.revealAudio) return ftoToClip(ftoEntry.revealAudio);
    // AS reveal audio only when there's no reveal video (video provides audio).
    if (asEntry?.revealAudio && !asEntry.revealVideo) {
      return asAudioToClip(asEntry.revealAudio);
    }
    return undefined;
  }, [gtaEntry, sbEntry, sorEntry, sorRound, ftoEntry, asEntry]);

  const hasRichEntry =
    !!gtaEntry || !!sbEntry || !!sorEntry || !!ftoEntry || !!asEntry;

  // Track which audio target was last triggered so state churn doesn't restart it.
  const lastAudioKeyRef = useRef<string>('');

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

  const reloadWagers = useCallback(async (questionId: string | null) => {
    if (!questionId) {
      setWagers([]);
      return;
    }
    const { data } = await supabase
      .from('question_wagers')
      .select('team_id, wager_amount')
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
    reloadWagers,
    reloadIntroSubs,
    loadCurrentQuestion,
  ]);

  // Realtime: intro submissions (Fastest Fit First).
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`screen_intro:${game.id}`)
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

  // Live "now" tick while the intro countdown is running.
  useEffect(() => {
    if (!gameState?.intro_mode_active || gameState?.intro_revealed) return;
    const id = setInterval(() => setIntroNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameState?.intro_mode_active, gameState?.intro_revealed]);

  // Realtime: game_state
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`screen_state:${game.id}`)
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
          await loadCurrentQuestion(newState.current_question_id);
          await reloadWagers(newState.current_question_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, loadCurrentQuestion, reloadWagers]);

  // Realtime: wagers (CHANCEN) for the current question.
  useEffect(() => {
    if (!game || !gameState?.current_question_id) return;
    const qid = gameState.current_question_id;
    const channel = supabase
      .channel(`screen_wagers:${qid}`)
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
  }, [game, gameState?.current_question_id, reloadWagers]);

  // Realtime: teams (for scores + new joiners)
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`screen_teams:${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${game.id}`,
        },
        () => reloadTeams(game.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, reloadTeams]);

  // Realtime: questions (for is_answered updates)
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`screen_questions:${game.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'questions',
        },
        () => reloadQuestions(game.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, reloadQuestions]);

  // Realtime: audio control broadcast from host (transient, no DB write).
  // The host emits `stop_audio` / `toggle_waiting_mute` on audio_control:<gameId>.
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`audio_control:${game.id}`)
      .on('broadcast', { event: 'stop_audio' }, () => {
        lastAudioKeyRef.current = `stopped:${Date.now()}`;
        stop();
      })
      .on('broadcast', { event: 'toggle_waiting_mute' }, (msg) => {
        const muted = !!(msg.payload as { muted?: boolean })?.muted;
        setWaitingMuted(muted);
      })
      .on('broadcast', { event: 'play_cue' }, (msg) => {
        // Q100 (Archive Sounds) host-triggered short audio cue.
        const clip = msg.payload as AudioClipSpec;
        if (clip?.src) play(clip);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, stop]);

  // Waiting-room music: soft Lost Coconut loop while the join QR is shown.
  useEffect(() => {
    if (!audioEnabled) return;
    if (gameState?.show_join && !waitingMuted) {
      playWaiting({
        src: WAITING_MUSIC,
        startAt: 0,
        duration: 0,
        loop: true,
        volume: 0.3,
      });
    } else {
      stopWaiting();
    }
  }, [
    audioEnabled,
    gameState?.show_join,
    waitingMuted,
    playWaiting,
    stopWaiting,
  ]);

  // Audio orchestration (GTA + Selected Bangers). Plays the open clip when a
  // question opens (if defined), switches to the reveal clip when answers are
  // revealed, and stops on back-to-board.
  useEffect(() => {
    if (!audioEnabled) return;
    if (!currentQuestion || !hasRichEntry) {
      if (lastAudioKeyRef.current && !lastAudioKeyRef.current.startsWith('stopped')) {
        stop();
        lastAudioKeyRef.current = '';
      }
      return;
    }

    const revealed = !!gameState?.answer_revealed;
    // Include the active round so two-round questions replay per round.
    const roundTag = sorEntry?.type === 'tworound' ? `:r${activeRound}` : '';
    let key = '';
    if (revealed && revealClip) {
      key = `${currentQuestion.id}:reveal${roundTag}`;
    } else if (!revealed && openClip) {
      key = `${currentQuestion.id}:open${roundTag}`;
    }

    if (key && key !== lastAudioKeyRef.current) {
      lastAudioKeyRef.current = key;
      play(revealed ? revealClip! : openClip!);
    } else if (
      !key &&
      lastAudioKeyRef.current &&
      !lastAudioKeyRef.current.startsWith('stopped')
    ) {
      lastAudioKeyRef.current = '';
      stop();
    }
  }, [
    audioEnabled,
    currentQuestion,
    hasRichEntry,
    openClip,
    revealClip,
    gameState?.answer_revealed,
    sorEntry,
    activeRound,
    play,
    stop,
  ]);

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm uppercase tracking-widest text-stone-400">
          {loading ? 'Loading...' : 'Session not found'}
        </p>
      </main>
    );
  }

  // Audio enable gate — must appear regardless of which view we're in.
  // Browsers require a user gesture before .play() is allowed; once primed,
  // all subsequent programmatic playbacks during the session are permitted.
  const audioGate = !audioEnabled ? (
    <button
      onClick={() => {
        primeAudio();
        setAudioEnabled(true);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 backdrop-blur-sm cursor-pointer"
    >
      <div className="text-center px-8">
        <p className="text-xs uppercase tracking-[0.4em] text-stone-500 mb-6">
          Big screen
        </p>
        <p className="font-serif text-4xl md:text-5xl mb-8">
          Tap to <span className="italic">enable audio</span>
        </p>
        <p className="text-sm text-stone-500 max-w-md mx-auto">
          Browsers require a click before audio can autoplay. One tap here
          unlocks playback for the entire session.
        </p>
      </div>
    </button>
  ) : null;

  // Join overlay — host toggles this on the Big Screen so players can scan to
  // join. Shows a live list of teams as they sign in. Sits below the audio gate.
  const joinUrl = origin ? `${origin}/join/${game.code}` : '';
  const joinOverlay = gameState?.show_join ? (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-paper px-12">
      <p className="text-sm uppercase tracking-[0.4em] text-stone-500 mb-10">
        Scan to join
      </p>
      <div className="flex flex-col lg:flex-row items-center gap-16 max-w-6xl w-full justify-center">
        <div className="flex flex-col items-center">
          <div className="bg-white p-6 border border-stone-200">
            {joinUrl && (
              <QRCodeSVG
                value={joinUrl}
                size={320}
                level="M"
                fgColor="#0E0E0E"
                bgColor="#FFFFFF"
              />
            )}
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.3em] text-stone-500">
            Or enter code
          </p>
          <p className="font-serif italic text-4xl mt-1">{game.code}</p>
        </div>

        <div className="min-w-[260px]">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-4">
            In the room · {teams.length}
          </p>
          {teams.length === 0 ? (
            <p className="font-serif italic text-2xl text-stone-400">
              Waiting for the first team…
            </p>
          ) : (
            <ul className="space-y-1 max-h-[60vh] overflow-hidden">
              {teams.map((t) => (
                <li key={t.id} className="font-serif text-3xl">
                  {t.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Subtle Selected Sessions motion accent — kept low and unobtrusive */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-50 pointer-events-none">
        <SelectedSessionsLoader
          fullScreen={false}
          size="sm"
          background="transparent"
          srLabel="Waiting room"
        />
      </div>
    </div>
  ) : null;

  // Fastest Fit First — pre-game intro question overlay.
  const introOverlay = (() => {
    if (!gameState?.intro_mode_active) return null;
    const startedMs = gameState.intro_started_at
      ? new Date(gameState.intro_started_at).getTime()
      : 0;
    const elapsedSec = startedMs ? (introNow - startedMs) / 1000 : 0;
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
              (a.sub.submit_ms ?? 1e12) - (b.sub.submit_ms ?? 1e12)
            );
          })
      : [];
    const noSub = revealed
      ? teams.filter((t) => !submittedBy.has(t.id))
      : [];
    const winnerTeam = teams.find(
      (t) => t.id === gameState.intro_winning_team_id,
    );
    const pct = (remaining / INTRO_QUESTION.timerSeconds) * 100;

    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-paper p-12">
        <header className="flex justify-between items-start mb-12">
          <Logo size="md" />
          <p className="text-sm uppercase tracking-[0.3em] text-stone-500">
            Intro · {game?.code ?? ''}
          </p>
        </header>

        <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col">
          <p className="text-sm uppercase tracking-[0.4em] text-stone-500 mb-6">
            {INTRO_QUESTION.title}
          </p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tight mb-10">
            {INTRO_QUESTION.prompt}
          </h1>

          {!revealed ? (
            <>
              <ul className="grid grid-cols-2 gap-4 mb-10">
                {INTRO_QUESTION.options.map((opt) => (
                  <li
                    key={opt}
                    className="border border-stone-300 px-6 py-5 font-serif text-2xl"
                  >
                    {opt}
                  </li>
                ))}
              </ul>

              <div className="mb-8">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs uppercase tracking-widest text-stone-500">
                    Time
                  </p>
                  <p className="font-serif text-3xl">
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

              <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                Teams ({submittedBy.size}/{teams.length} locked)
              </p>
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                {teams.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between text-lg py-1 border-b border-stone-200"
                  >
                    <span className="font-serif">{t.name}</span>
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
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                Results
              </p>
              <ul className="mb-8 space-y-1">
                {ranked.map(({ sub, team }, i) => (
                  <li
                    key={sub.id}
                    className="flex justify-between py-3 border-b border-stone-200"
                  >
                    <span className="font-serif text-2xl">
                      <span className="italic text-stone-500 mr-4">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {team?.name ?? '—'}
                    </span>
                    <span
                      className={
                        sub.is_correct
                          ? 'uppercase tracking-widest text-sm text-ink'
                          : 'uppercase tracking-widest text-sm text-stone-400'
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
                    className="flex justify-between py-3 border-b border-stone-200 text-stone-400"
                  >
                    <span className="font-serif text-2xl">{t.name}</span>
                    <span className="uppercase tracking-widest text-sm">
                      No submission
                    </span>
                  </li>
                ))}
              </ul>

              {winnerTeam ? (
                <p className="font-serif italic text-5xl md:text-6xl">
                  {winnerTeam.name} starts the session.
                </p>
              ) : (
                <p className="font-serif italic text-3xl text-stone-500">
                  No exact match — host selects the starting team.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  })();

  // ---- Leaderboard view ----
  if (gameState?.show_leaderboard) {
    return (
      <main className="min-h-screen bg-ink text-paper p-12 flex flex-col">
        {audioGate}
        {joinOverlay}
        {introOverlay}
        <header className="flex justify-between items-start mb-16">
          <Logo size="md" variant="white" />
          <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
            Code · {game.code} · Leaderboard
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full">
          <h1 className="font-serif text-7xl md:text-8xl mb-16 tracking-tight">
            Standings
          </h1>
          <ul className="space-y-px">
            {teams.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center justify-between py-6 border-b border-stone-700"
              >
                <div className="flex items-center gap-8">
                  <span className="font-serif italic text-4xl text-stone-500 w-16">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-3xl">{t.name}</span>
                </div>
                <span className="font-serif text-5xl">{t.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  // ---- Active question view ----
  if (currentQuestion) {
    const revealed = !!gameState?.answer_revealed;
    const isTwoRound = sorEntry?.type === 'tworound';
    const isChance = sorEntry?.type === 'chance';
    const isMulti = sorEntry?.type === 'multiselect';
    const chanceStarted = !!gameState?.chance_started;
    const chancePre = isChance && !chanceStarted && !revealed;
    const displayTitle = chancePre
      ? undefined
      : (sbEntry?.title ?? sorEntry?.title ?? asEntry?.title);
    const displayPrompt = chancePre
      ? 'CHANCEN'
      : isTwoRound && !revealed && sorRound
        ? `“${sorRound.statement}”`
        : (gtaEntry?.prompt ??
          sbEntry?.prompt ??
          sorEntry?.prompt ??
          asEntry?.prompt ??
          currentQuestion.prompt);
    const sorAnswer = sorEntry
      ? sorEntry.type === 'majority'
        ? (gameState?.winning_answer ?? '—')
        : (sorEntry.correct ?? currentQuestion.answer)
      : null;
    const displayAnswer =
      gtaEntry?.answer ??
      sbEntry?.answer ??
      sorAnswer ??
      asEntry?.answer ??
      currentQuestion.answer;
    const trackInfo = sbEntry?.trackInfo ?? sorEntry?.track ?? asEntry?.track;
    const imageSrc = gtaEntry
      ? revealed
        ? gtaEntry.revealedImage
        : gtaEntry.initialImage
      : null;
    // Show the animated loader while an open audio clip is playing.
    const showAudioVisual = !!openClip && !revealed;

    // ---- Finish the (Out)fit: dedicated lyric layout ----
    if (ftoEntry) {
      const answersOpenF = !!gameState?.answers_open;
      const qDuration = openClip?.duration ?? 30;
      return (
        <main className="min-h-screen bg-paper text-ink p-12 flex flex-col relative">
          {audioGate}
          {joinOverlay}
        {introOverlay}
          <header className="flex justify-between items-start mb-12">
            <Logo size="md" />
            <p className="text-sm uppercase tracking-[0.3em] text-stone-500">
              Code · {game.code} · {currentQuestion.points} pts
            </p>
          </header>

          <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
            <p className="text-sm uppercase tracking-[0.4em] text-stone-500 mb-3">
              {ftoEntry.title}
            </p>
            <p className="font-serif italic text-2xl md:text-3xl text-stone-600 mb-12">
              {ftoEntry.track}
            </p>

            {revealed ? (
              <div>
                <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
                  The missing line
                </p>
                <p className="font-serif text-5xl md:text-7xl leading-tight">
                  {ftoEntry.correctAnswer ? (
                    <Typewriter text={ftoEntry.correctAnswer} />
                  ) : (
                    <span className="tracking-[0.15em] text-stone-500">
                      {ftoEntry.maskedAnswer}
                    </span>
                  )}
                </p>
              </div>
            ) : answersOpenF ? (
              <div>
                <p className="text-xl uppercase tracking-[0.3em] text-stone-500 mb-6">
                  Finish the next line — answer on your phone
                </p>
                <p className="font-serif text-5xl md:text-7xl tracking-[0.15em] text-stone-500">
                  {ftoEntry.maskedAnswer}
                </p>
              </div>
            ) : (
              <LyricTicker
                lines={ftoEntry.lyricLines}
                durationSec={qDuration}
                resetKey={currentQuestion.id}
                timings={ftoEntry.lyricTimings}
                maskedTime={ftoEntry.maskedAnswerTime}
                maskedAnswer={ftoEntry.maskedAnswer}
              />
            )}
          </div>

          <footer className="flex justify-between items-end mt-12">
            <p className="text-sm uppercase tracking-widest text-stone-500">
              {teams.length} teams in the room
            </p>
            {teams.slice(0, 3).map((t, i) => (
              <p key={t.id} className="text-sm uppercase tracking-widest">
                {i + 1}. {t.name} · {t.score}
              </p>
            ))}
          </footer>
        </main>
      );
    }

    const asQVid: AsVideoSegment | undefined =
      asEntry?.questionVideo && !revealed ? asEntry.questionVideo : undefined;
    const asRVid: AsVideoSegment | undefined =
      asEntry?.revealVideo && revealed ? asEntry.revealVideo : undefined;

    return (
      <main className="min-h-screen bg-paper text-ink p-12 flex flex-col relative overflow-hidden">
        {audioGate}
        {joinOverlay}
        {introOverlay}

        {/* Archive Sounds Q300: background video behind question content */}
        {asQVid && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <VideoSegment
              src={asQVid.src}
              startTime={asQVid.startTime}
              durationSec={asVideoDuration(asQVid)}
              baseOpacity={asQVid.opacity ?? 1}
              fadeOutSec={asQVid.fadeOutSeconds ?? 0}
              fadeToOpacity={asQVid.fadeOutVideoToOpacity}
              includeAudio={asQVid.includeAudio !== false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        )}

        <header className="flex justify-between items-start mb-12 relative z-10">
          <Logo size="md" />
          <p className="text-sm uppercase tracking-[0.3em] text-stone-500">
            Code · {game.code} · {currentQuestion.points} pts
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full relative z-10">
          {displayTitle && (
            <p className="text-sm uppercase tracking-[0.4em] text-stone-500 mb-6">
              {displayTitle}
            </p>
          )}

          <h1
            className={
              chancePre
                ? 'font-serif text-7xl md:text-9xl mb-8 ss-chancen-in'
                : 'font-serif text-6xl md:text-8xl leading-[1.05] tracking-tight mb-8'
            }
          >
            {displayPrompt}
          </h1>

          {chancePre && (
            <div>
              <p className="text-xl uppercase tracking-[0.3em] text-stone-500 mb-8">
                Place your wagers on your device
              </p>
              <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
                {wagers.length} / {teams.length} wagers in
              </p>
            </div>
          )}

          {sorEntry?.subPrompt && !revealed && (!isChance || chanceStarted) && (
            <p className="text-xl uppercase tracking-[0.3em] text-stone-500 mb-8">
              {sorEntry.subPrompt}
            </p>
          )}

          {/* CHANCEN: show the wagers once the question has started */}
          {isChance && chanceStarted && !revealed && wagers.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-x-8 gap-y-2">
              {teams.map((t) => {
                const w = wagers.find((x) => x.team_id === t.id);
                if (!w) return null;
                return (
                  <p key={t.id} className="font-serif text-2xl">
                    {t.name}{' '}
                    <span className="italic text-stone-500">
                      · {w.wager_amount}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {/* Multi-select: the 10-song list (highlight the correct 3 on reveal) */}
          {isMulti && sorEntry?.songs && (
            <ol className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 list-decimal list-inside">
              {sorEntry.songs.map((s, i) => {
                const correct = revealed && sorEntry.correctSongs?.includes(i);
                return (
                  <li
                    key={i}
                    className={
                      correct
                        ? 'font-serif italic text-3xl text-ink'
                        : 'text-xl text-stone-500'
                    }
                  >
                    {correct ? '★ ' : ''}
                    {s}
                  </li>
                );
              })}
            </ol>
          )}

          {isTwoRound && !revealed && (
            <p className="text-xl uppercase tracking-[0.3em] text-stone-500 mb-8">
              Round {activeRound + 1} of {sorEntry?.rounds?.length ?? 2} ·
              Selected or Rejected?
            </p>
          )}

          {trackInfo && (
            <p className="font-serif italic text-3xl md:text-4xl text-stone-600 mb-10">
              {trackInfo}
            </p>
          )}

          {/* GTA image (initial or revealed) */}
          {gtaEntry?.type === 'image' && imageSrc && (
            <div className="mb-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={encodeURI(imageSrc)}
                alt={revealed ? displayAnswer : 'Guess the artist'}
                className="max-h-[55vh] w-auto mx-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Reveal image for non-image questions (GTA / SB / Archive Sounds) */}
          {revealed &&
            (gtaEntry?.revealImage ||
              sbEntry?.revealImage ||
              asEntry?.revealImage) && (
              <div className="mb-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI(
                    (gtaEntry?.revealImage ??
                      sbEntry?.revealImage ??
                      asEntry?.revealImage)!,
                  )}
                  alt={displayAnswer}
                  className="max-h-[50vh] w-auto mx-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      'none';
                  }}
                />
              </div>
            )}

          {/* Audio question — show the Selected Sessions loader as visual */}
          {showAudioVisual && (
            <div className="mb-12">
              <SelectedSessionsLoader
                fullScreen={false}
                size="sm"
                background="transparent"
                srLabel="Audio playing on the Big Screen"
              />
            </div>
          )}

          {/* Legacy native audio for any plain question that still uses audio_url */}
          {!hasRichEntry && currentQuestion.audio_url && (
            <div className="mb-12">
              <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
                Audio
              </p>
              <audio
                controls
                src={currentQuestion.audio_url}
                className="w-full max-w-2xl"
              />
            </div>
          )}

          {revealed && isTwoRound && sorEntry?.rounds ? (
            <div className="border-t border-ink pt-8 space-y-6">
              {sorEntry.rounds.map((r, i) => (
                <div key={i}>
                  <p className="text-sm uppercase tracking-widest text-stone-500 mb-1">
                    Round {i + 1} — “{r.statement}”
                  </p>
                  <p className="font-serif italic text-4xl md:text-5xl">
                    {r.correct}
                  </p>
                  <p className="mt-1 text-xl text-stone-600">{r.explanation}</p>
                </div>
              ))}
            </div>
          ) : revealed && isMulti ? (
            <div className="border-t border-ink pt-8">
              <p className="text-sm uppercase tracking-widest text-stone-500">
                The 3 correct songs are starred above
              </p>
            </div>
          ) : revealed ? (
            <div className="border-t border-ink pt-8">
              {/* Archive Sounds reveal video (Q300/Q400) — plays its own audio */}
              {asRVid && (
                <div className="mb-8">
                  <VideoSegment
                    src={asRVid.src}
                    startTime={asRVid.startTime}
                    durationSec={asVideoDuration(asRVid)}
                    baseOpacity={asRVid.opacity ?? 1}
                    fadeOutSec={asRVid.fadeOutSeconds ?? 0}
                    fadeToOpacity={asRVid.fadeOutVideoToOpacity}
                    includeAudio={asRVid.includeAudio !== false}
                    className="max-h-[55vh] w-auto mx-auto"
                  />
                </div>
              )}
              <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
                Answer
              </p>
              <p className="font-serif italic text-5xl md:text-7xl">
                {displayAnswer}
              </p>
              {sorEntry?.revealExplanation && (
                <p className="mt-6 text-2xl text-stone-600 max-w-4xl">
                  {sorEntry.revealExplanation}
                </p>
              )}
            </div>
          ) : (
            <div className="border-t border-stone-300 pt-8">
              <p className="text-sm uppercase tracking-widest text-stone-500">
                Status
              </p>
              <p className="font-serif text-4xl md:text-5xl mt-2">
                {gameState?.answers_open ? (
                  <span>
                    Submissions <span className="italic">open</span>
                  </span>
                ) : (
                  <span>
                    Submissions <span className="italic">locked</span>
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <footer className="flex justify-between items-end mt-12">
          <p className="text-sm uppercase tracking-widest text-stone-500">
            {teams.length} teams in the room
          </p>
          {teams.slice(0, 3).map((t, i) => (
            <p key={t.id} className="text-sm uppercase tracking-widest">
              {i + 1}. {t.name} · {t.score}
            </p>
          ))}
        </footer>
      </main>
    );
  }

  // ---- Default: Board view ----
  return (
    <main className="min-h-screen bg-paper text-ink p-12 flex flex-col">
      {audioGate}
        {joinOverlay}
        {introOverlay}
      <header className="flex justify-between items-start mb-12">
        <Logo size="md" />
        <div className="text-right">
          <p className="text-sm uppercase tracking-[0.3em] text-stone-500">
            Join at this URL
          </p>
          <p className="font-serif text-3xl mt-1">
            Code · <span className="italic">{game.code}</span>
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mt-3">
            {teams.length} teams in the room
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-5 gap-px bg-stone-300 border border-stone-300 mb-12">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-ink text-paper p-6 min-h-[100px] flex items-center justify-center"
            >
              <p className="font-serif italic text-xl text-center leading-tight">
                {cat.name}
              </p>
            </div>
          ))}
          {[100, 200, 300, 400, 500].flatMap((points) =>
            categories.map((cat) => {
              const q = cat.questions.find((q) => q.points === points);
              return (
                <div
                  key={`${cat.id}-${points}`}
                  className={`p-8 text-center min-h-[120px] flex items-center justify-center ${
                    q?.is_answered
                      ? 'bg-stone-100 text-stone-300'
                      : 'bg-paper'
                  }`}
                >
                  <span className="font-serif text-5xl">
                    {q?.is_answered ? '—' : points}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {teams.length > 0 && (
          <div>
            <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
              In the room
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {teams.map((t) => (
                <p key={t.id} className="font-serif text-2xl">
                  {t.name} <span className="italic text-stone-500">· {t.score}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
