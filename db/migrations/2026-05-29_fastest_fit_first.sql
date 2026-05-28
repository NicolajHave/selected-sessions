-- =====================================================================
-- Migration: Fastest Fit First (pre-game intro question)
-- Run once in the Supabase SQL Editor.
-- =====================================================================

-- 1. game_state intro flags
alter table game_state
  add column if not exists intro_mode_active boolean not null default false,
  add column if not exists intro_started_at timestamptz,
  add column if not exists intro_revealed boolean not null default false,
  add column if not exists intro_winning_team_id uuid references teams(id) on delete set null;

-- 2. intro submissions (separate from quiz submissions)
create table if not exists intro_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  submitted_order jsonb not null,
  is_correct boolean,
  submitted_at timestamptz not null default now(),
  submit_ms integer,
  unique (game_id, team_id)
);

create index if not exists idx_intro_subs_game on intro_submissions(game_id);

alter table intro_submissions enable row level security;

drop policy if exists "public read intro_submissions" on intro_submissions;
create policy "public read intro_submissions"
  on intro_submissions for select using (true);

drop policy if exists "public insert intro_submissions" on intro_submissions;
create policy "public insert intro_submissions"
  on intro_submissions for insert with check (true);

alter publication supabase_realtime add table intro_submissions;
