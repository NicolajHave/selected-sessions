-- ============================================
-- Selected Sessions — Database schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enums
create type game_status as enum ('lobby', 'active', 'finished');
create type question_type as enum ('classic', 'audio', 'lyric', 'judgement', 'risk');

-- Games
create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status game_status not null default 'lobby',
  created_at timestamptz not null default now()
);

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  position integer not null
);

-- Questions
create table questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  points integer not null,
  type question_type not null default 'classic',
  prompt text not null,
  answer text not null,
  audio_url text,
  external_link text,
  host_note text,
  is_answered boolean not null default false
);

-- Submissions
create table submissions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  answer_text text not null,
  submitted_at timestamptz not null default now()
);

-- Game state (one row per game)
create table game_state (
  game_id uuid primary key references games(id) on delete cascade,
  current_question_id uuid references questions(id) on delete set null,
  answers_open boolean not null default false,
  answer_revealed boolean not null default false,
  show_leaderboard boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Paid hint purchases (Selected Bangers Q500)
create table team_question_hints (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  hint_type text not null default 'paid_hint',
  cost integer not null default 100,
  created_at timestamptz not null default now(),
  unique (team_id, question_id)
);

-- Indexes
create index idx_teams_game_id on teams(game_id);
create index idx_categories_game_id on categories(game_id);
create index idx_questions_category_id on questions(category_id);
create index idx_submissions_question_id on submissions(question_id);
create index idx_submissions_team_id on submissions(team_id);
create index idx_tqh_team on team_question_hints(team_id);
create index idx_tqh_question on team_question_hints(question_id);

-- Realtime
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table submissions;
alter publication supabase_realtime add table questions;
alter publication supabase_realtime add table team_question_hints;

-- Row Level Security
alter table games enable row level security;
alter table teams enable row level security;
alter table categories enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table game_state enable row level security;
alter table team_question_hints enable row level security;

-- Public read
create policy "public read games" on games for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read categories" on categories for select using (true);
create policy "public read questions" on questions for select using (true);
create policy "public read submissions" on submissions for select using (true);
create policy "public read game_state" on game_state for select using (true);
create policy "public read team_question_hints" on team_question_hints for select using (true);

-- Public insert (teams + submissions)
create policy "public insert teams" on teams for insert with check (true);
create policy "public insert submissions" on submissions for insert with check (true);
