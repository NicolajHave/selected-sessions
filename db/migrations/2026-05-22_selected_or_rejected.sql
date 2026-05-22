-- =====================================================================
-- Migration: Selected or Rejected foundation
-- Run once in the Supabase SQL Editor.
--
-- Adds the data needed for automatic scoring, structured answers, the
-- two-round / majority / chance / multi-select mechanics, and refreshes the
-- five Selected or Rejected question rows. Behavioral config lives in code
-- (lib/quiz/selected-or-rejected.ts).
-- =====================================================================

-- 1. Structured answer payloads (Selected/Rejected, multi-select, rounds)
alter table submissions
  add column if not exists answer_payload jsonb not null default '{}'::jsonb;

-- 2. Idempotent auto-scoring marker
alter table questions
  add column if not exists auto_scored boolean not null default false;

-- 3. Extra live-state fields for the new mechanics
alter table game_state
  add column if not exists active_round integer not null default 0;
alter table game_state
  add column if not exists winning_answer text;
alter table game_state
  add column if not exists chance_started boolean not null default false;

-- 4. CHANCEN wagers (Q400)
create table if not exists question_wagers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  wager_amount integer not null,
  created_at timestamptz not null default now(),
  unique (team_id, question_id)
);

create index if not exists idx_wagers_question on question_wagers(question_id);
create index if not exists idx_wagers_team on question_wagers(team_id);

alter table question_wagers enable row level security;

drop policy if exists "public read question_wagers" on question_wagers;
create policy "public read question_wagers"
  on question_wagers for select using (true);

drop policy if exists "public insert question_wagers" on question_wagers;
create policy "public insert question_wagers"
  on question_wagers for insert with check (true);

alter publication supabase_realtime add table question_wagers;

-- 5. Refresh the five Selected or Rejected questions
with cat as (
  select id from categories where name = 'Selected or Rejected' limit 1
)
update questions q set
  prompt = data.prompt,
  answer = data.answer,
  type = 'judgement'::question_type,
  audio_url = null,
  host_note = data.host_note
from (
  values
    (100, 'Shu-Bi-Dua’s song was previously part of Højskolesangbogen, but was removed again due to debate about whether it belonged there.',
     'Selected', 'The Songbook Check (true/false). Auto-scored: Selected = 100.'),
    (200, 'Real lyric or fake lyric? (two rounds)',
     'Round 1: Rejected · Round 2: Rejected', 'The Lyric Check. Two rounds, 100 each, auto-scored.'),
    (300, 'Would this song be Selected enough to be played at the Selected Summer Party?',
     'Majority decides', 'The Summer Party Vote (Journey). Majority wins 300; host breaks ties.'),
    (400, 'Celine Dion once participated in Eurovision.',
     'Selected', 'CHANCEN wager question. Auto-scored: add/subtract wager.'),
    (500, 'Which 3 of these songs would Nicolaj 100%% sing along to?',
     'Drake — Controlla · Panic! At The Disco — But It’s Better If You Do · Ellie Goulding — Lights',
     'Nicolaj’s Playlist (pick 3). Auto-scored tiered: 3=500,2=300,1=100.')
) as data(points, prompt, answer, host_note)
where q.points = data.points and q.category_id = (select id from cat);
