'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  supabase,
  type Game,
  type GameState,
  type Category,
  type Question,
  type Team,
} from '@/lib/supabase/client';

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

  if (loading || !game) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm uppercase tracking-widest text-stone-400">
          {loading ? 'Loading...' : 'Session not found'}
        </p>
      </main>
    );
  }

  // ---- Leaderboard view ----
  if (gameState?.show_leaderboard) {
    return (
      <main className="min-h-screen bg-ink text-paper p-12 flex flex-col">
        <header className="flex justify-between items-center mb-16">
          <p className="text-sm uppercase tracking-widest text-stone-400">
            Selected Sessions · {game.code}
          </p>
          <p className="text-sm uppercase tracking-widest text-stone-400">
            Leaderboard
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
    return (
      <main className="min-h-screen bg-paper text-ink p-12 flex flex-col">
        <header className="flex justify-between items-center mb-12">
          <p className="text-sm uppercase tracking-widest text-stone-500">
            Selected Sessions · {game.code}
          </p>
          <p className="text-sm uppercase tracking-widest text-stone-500">
            {currentQuestion.points} points · {currentQuestion.type}
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
          <h1 className="font-serif text-6xl md:text-8xl leading-[1.05] tracking-tight mb-16">
            {currentQuestion.prompt}
          </h1>

          {currentQuestion.audio_url && (
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

          {gameState?.answer_revealed ? (
            <div className="border-t border-ink pt-8">
              <p className="text-sm uppercase tracking-widest text-stone-500 mb-4">
                Answer
              </p>
              <p className="font-serif italic text-5xl md:text-7xl">
                {currentQuestion.answer}
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
      <header className="flex justify-between items-center mb-12">
        <div>
          <p className="text-sm uppercase tracking-widest text-stone-500">
            Selected Sessions
          </p>
          <p className="font-serif text-2xl mt-1">
            Join with code: <span className="italic">{game.code}</span>
          </p>
        </div>
        <p className="text-sm uppercase tracking-widest text-stone-500">
          {teams.length} teams · waiting for next question
        </p>
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
