-- =====================================================================
-- Migration: refresh "Guess the Artist" category for the Selected team day
-- Run this once in the Supabase SQL Editor.
--
-- It updates the prompts/answers/types of the 5 existing rows in the
-- "Guess the Artist" category for the DEMO game. Image and audio behavior
-- is driven by code (lib/quiz/guess-the-artist.ts) and does not need DB
-- columns.
-- =====================================================================

with cat as (
  select c.id
  from categories c
  join games g on g.id = c.game_id
  where c.name = 'Guess the Artist' and g.code = 'DEMO'
  limit 1
)
update questions q set
  prompt = data.prompt,
  answer = data.answer,
  type = data.type::question_type,
  audio_url = null,
  host_note = data.host_note
from (
  values
    (100, 'Hvem er dette?', 'Kato', 'classic',
     'Image question. Big Screen shows Kato_Billede1.jpg; reveal swaps to Kato_Billede2.jpg and plays a 15s clip.'),
    (200, 'Hvem lavede dette nummer?', 'Elton John - Tiny Dancer', 'audio',
     'Tiny Dancer plays on the Big Screen on open (max 120s). Reveal plays a separate 15s clip.'),
    (300, 'Hvem åbnede Orange Scene i 2025?', 'Annika', 'classic',
     'Text-only. Reveal plays "Blodigt (feat. Annika)" from 0:59 for 15s.'),
    (400, 'Who did this song?', 'Swedish House Mafia & Coldplay - Every Teardrop is a Waterfall', 'audio',
     'Plays from 1:08 for 60s on open. Reveal plays from 4:42 for 15s.'),
    (500, 'Who did this song?', 'Queen - Fat Bottomed Girls', 'audio',
     'Plays from 0:00 for 95s on open. Reveal plays from 2:15 for 15s.')
) as data(points, prompt, answer, type, host_note)
where q.points = data.points and q.category_id = (select id from cat);
