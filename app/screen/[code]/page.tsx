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
} from '@/lib/supabase/client';
import { Logo } from '@/components/shared/Logo';
import { SelectedSessionsLoader } from '@/components/SelectedSessionsLoader';
import { useAudioClip } from '@/lib/audio/useAudioClip';
import {
  getGuessTheArtistEntry,
  type GuessTheArtistEntry,
} from '@/lib/quiz/guess-the-artist';

interface CategoryWithQuestions extends Category {
  questions: Question[];
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

  const { play, stop, primeAudio } = useAudioClip();

  // Look up rich GTA metadata for the current question (or null if N/A).
  const gtaEntry: GuessTheArtistEntry | null = useMemo(() => {
    if (!currentQuestion) return null;
    const cat = categories.find((c) => c.id === currentQuestion.category_id);
    return getGuessTheArtistEntry(cat?.name, currentQuestion.points);
  }, [currentQuestion, categories]);

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
      }

      setLoading(false);
    }

    init();
  }, [code, reloadQuestions, reloadTeams, loadCurrentQuestion]);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, loadCurrentQuestion]);

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
  // The host emits `stop_audio` on `audio_control:<gameId>` when stopping early.
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel(`audio_control:${game.id}`)
      .on('broadcast', { event: 'stop_audio' }, () => {
        lastAudioKeyRef.current = `stopped:${Date.now()}`;
        stop();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game, stop]);

  // GTA audio orchestration. Plays open clip when a question opens (if defined),
  // switches to the reveal clip when answers are revealed, stops on back-to-board.
  useEffect(() => {
    if (!audioEnabled) return;
    if (!currentQuestion || !gtaEntry) {
      if (lastAudioKeyRef.current && !lastAudioKeyRef.current.startsWith('stopped')) {
        stop();
        lastAudioKeyRef.current = '';
      }
      return;
    }

    const revealed = !!gameState?.answer_revealed;
    let key = '';
    if (revealed && gtaEntry.revealAudio) {
      key = `${currentQuestion.id}:reveal`;
    } else if (!revealed && gtaEntry.openAudio) {
      key = `${currentQuestion.id}:open`;
    }

    if (key && key !== lastAudioKeyRef.current) {
      lastAudioKeyRef.current = key;
      const clip = revealed ? gtaEntry.revealAudio! : gtaEntry.openAudio!;
      play(clip);
    } else if (!key && lastAudioKeyRef.current && !lastAudioKeyRef.current.startsWith('stopped')) {
      lastAudioKeyRef.current = '';
      stop();
    }
  }, [audioEnabled, currentQuestion, gtaEntry, gameState?.answer_revealed, play, stop]);

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

  // ---- Leaderboard view ----
  if (gameState?.show_leaderboard) {
    return (
      <main className="min-h-screen bg-ink text-paper p-12 flex flex-col">
        {audioGate}
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
    const displayPrompt = gtaEntry?.prompt ?? currentQuestion.prompt;
    const displayAnswer = gtaEntry?.answer ?? currentQuestion.answer;
    const imageSrc = gtaEntry
      ? revealed
        ? gtaEntry.revealedImage
        : gtaEntry.initialImage
      : null;
    const isGtaAudioQuestion = !!gtaEntry?.openAudio;

    return (
      <main className="min-h-screen bg-paper text-ink p-12 flex flex-col relative">
        {audioGate}

        <header className="flex justify-between items-start mb-12">
          <Logo size="md" />
          <p className="text-sm uppercase tracking-[0.3em] text-stone-500">
            Code · {game.code} · {currentQuestion.points} pts
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
          <h1 className="font-serif text-6xl md:text-8xl leading-[1.05] tracking-tight mb-12">
            {displayPrompt}
          </h1>

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

          {/* GTA audio question — show the Selected Sessions loader as visual */}
          {isGtaAudioQuestion && !revealed && (
            <div className="mb-12">
              <SelectedSessionsLoader
                fullScreen={false}
                size="sm"
                background="transparent"
                srLabel="Audio playing on the Big Screen"
              />
            </div>
          )}

          {/* Legacy native audio for any non-GTA question that still uses audio_url */}
          {!gtaEntry && currentQuestion.audio_url && (
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

          {revealed ? (
            <div className="border-t border-ink pt-8">
              <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
                Answer
              </p>
              <p className="font-serif italic text-5xl md:text-7xl">
                {displayAnswer}
              </p>
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
