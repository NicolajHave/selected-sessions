import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type GameStatus = 'lobby' | 'active' | 'finished';
export type QuestionType =
  | 'classic'
  | 'audio'
  | 'lyric'
  | 'judgement'
  | 'risk';

export interface Game {
  id: string;
  code: string;
  status: GameStatus;
  created_at: string;
}

export interface Team {
  id: string;
  game_id: string;
  name: string;
  score: number;
  created_at: string;
}

export interface Category {
  id: string;
  game_id: string;
  name: string;
  position: number;
}

export interface Question {
  id: string;
  category_id: string;
  points: number;
  type: QuestionType;
  prompt: string;
  answer: string;
  audio_url: string | null;
  external_link: string | null;
  host_note: string | null;
  is_answered: boolean;
}

export interface Submission {
  id: string;
  question_id: string;
  team_id: string;
  answer_text: string;
  answer_payload: Record<string, unknown>;
  submitted_at: string;
}

export interface GameState {
  game_id: string;
  current_question_id: string | null;
  answers_open: boolean;
  answer_revealed: boolean;
  show_leaderboard: boolean;
  show_join: boolean;
  active_round: number;
  winning_answer: string | null;
  chance_started: boolean;
  updated_at: string;
}

export interface QuestionWager {
  id: string;
  game_id: string;
  team_id: string;
  question_id: string;
  wager_amount: number;
  created_at: string;
}

export interface TeamQuestionHint {
  id: string;
  game_id: string;
  team_id: string;
  question_id: string;
  hint_type: string;
  cost: number;
  created_at: string;
}
