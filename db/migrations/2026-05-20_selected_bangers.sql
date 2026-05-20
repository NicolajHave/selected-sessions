-- =====================================================================
-- Migration: Selected Bangers category + new category names + paid hints
-- Run once in the Supabase SQL Editor.
--
-- 1. Renames all five categories to the final team-day names and order.
-- 2. Refreshes the 5 Selected Bangers questions (prompts/answers/types).
-- 3. Creates the team_question_hints table for the Q500 paid hint.
--
-- Behavioral config (audio segments, slider, bonus, hint) lives in code:
--   lib/quiz/selected-bangers.ts
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rename + reorder categories (scoped to the DEMO game)
-- ---------------------------------------------------------------------
update categories c set name = 'Guess the Artist', position = 0
  from games g where g.id = c.game_id and g.code = 'DEMO'
  and c.name = 'Guess the Artist';

update categories c set name = 'Selected Bangers', position = 1
  from games g where g.id = c.game_id and g.code = 'DEMO'
  and c.name = 'Brand Space Bangers';

update categories c set name = 'Selected or Rejected', position = 2
  from games g where g.id = c.game_id and g.code = 'DEMO'
  and c.name = 'Selected or Rejected';

update categories c set name = 'Finish the (Out)fit', position = 3
  from games g where g.id = c.game_id and g.code = 'DEMO'
  and c.name = 'Campaign Moodboard';

update categories c set name = 'Archive Sounds', position = 4
  from games g where g.id = c.game_id and g.code = 'DEMO'
  and c.name = 'Office Anthems';

-- ---------------------------------------------------------------------
-- 2. Refresh the Selected Bangers questions
-- ---------------------------------------------------------------------
with cat as (
  select c.id
  from categories c
  join games g on g.id = c.game_id
  where c.name = 'Selected Bangers' and g.code = 'DEMO'
  limit 1
)
update questions q set
  prompt = data.prompt,
  answer = data.answer,
  type = 'audio'::question_type,
  audio_url = null,
  host_note = data.host_note
from (
  values
    (100, 'Name the track and artist before the drop hits.',
     'Levels — Avicii',
     'The Drop. Plays 1:24–2:24, answers auto-close on clip end.'),
    (200, 'Who made this song, and who is featured on it? Name at least one featured artist.',
     'Daft Punk — Get Lucky. Featured artists: Pharrell Williams and Nile Rodgers.',
     'The Groove. Award if they say Daft Punk + at least one of Pharrell / Nile Rodgers.'),
    (300, 'Which two songs are mixed in this track? Name either the song titles or the artists.',
     'I Like To Move It — Reel 2 Real  &  Temperature — Sean Paul',
     'The Mashup. +50 bonus if both titles AND both artists.'),
    (400, 'What year was this song released?',
     '2009',
     'The Night Club Banger (I Gotta Feeling — Black Eyed Peas). Year slider 2000–2010.'),
    (500, 'Which country is this song from?',
     'Italy',
     'The Origin (Freed From Desire). Teams can buy a private hint for 100 pts.')
) as data(points, prompt, answer, host_note)
where q.points = data.points and q.category_id = (select id from cat);

-- ---------------------------------------------------------------------
-- 3. Paid hint purchases
-- ---------------------------------------------------------------------
create table if not exists team_question_hints (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  hint_type text not null default 'paid_hint',
  cost integer not null default 100,
  created_at timestamptz not null default now(),
  unique (team_id, question_id)
);

create index if not exists idx_tqh_team on team_question_hints(team_id);
create index if not exists idx_tqh_question on team_question_hints(question_id);

alter table team_question_hints enable row level security;

drop policy if exists "public read team_question_hints" on team_question_hints;
create policy "public read team_question_hints"
  on team_question_hints for select using (true);

-- Realtime so a team's player screen sees the hint the moment the host grants it.
alter publication supabase_realtime add table team_question_hints;
