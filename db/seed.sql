-- ============================================
-- Seed: Standard Selected Sessions quiz
-- Run after schema.sql
-- ============================================

insert into games (code, status) values ('B2BTEAMDAY', 'lobby');

with g as (select id from games where code = 'B2BTEAMDAY')
insert into categories (game_id, name, position)
select g.id, name, position from g, (values
  ('Guess the Artist', 0),
  ('Selected Bangers', 1),
  ('Selected or Rejected', 2),
  ('Finish the (Out)fit', 3),
  ('Archive Sounds', 4)
) as v(name, position);

with c as (select id from categories where name = 'Finish the (Out)fit')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvilket årti forbindes mest med Calvin Kleins ikoniske underwear-kampagner?', '1990''erne', 'Klassisk opvarmer.'),
  (200, 'audio', 'Navngiv kunstneren bag denne track.', 'Dua Lipa', 'Afspil 10 sek. fra "Levitating".'),
  (300, 'lyric', 'Færdiggør lyrikken: "We found love in a..."', 'hopeless place', 'Rihanna — alle bør kunne den her.'),
  (400, 'judgement', 'En ny kampagne lanceres med en ekstremt kontroversiel kunstner. Brand fit eller no-go?', 'Diskussion — host vurderer', 'Åben for debat. Bedste begrundelse vinder.'),
  (500, 'risk', 'RISK: Navngiv 5 modemærker der har samarbejdet med musikartister i 2024.', 'Eksempler: Loewe x Charli XCX, Skims x Usher, Marc Jacobs x Charli, etc.', 'Risk-felt: alt eller intet.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Archive Sounds')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvilken kunstner står bag "Bad Guy"?', 'Billie Eilish', null),
  (200, 'audio', 'Hvilken sang er det her?', 'Blinding Lights — The Weeknd', 'Afspil intro.'),
  (300, 'lyric', 'Færdiggør: "Is this the real life? Is this just..."', 'fantasy', 'Bohemian Rhapsody.'),
  (400, 'classic', 'Hvilken dansk artist vandt et Grammy i 2024?', 'MØ (eller relevant aktuelt svar — host justerer)', 'Tjek aktuelle vindere før dagen.'),
  (500, 'risk', 'RISK: Nævn 3 sange der har været #1 i Danmark de seneste 12 måneder.', 'Host vurderer baseret på aktuelle hitlister', 'Risk-felt.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Selected Bangers')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'audio', 'Name the track and artist before the drop hits.', 'Levels — Avicii',
   'The Drop. Plays 1:24–2:24, answers auto-close on clip end.'),
  (200, 'audio', 'Who made this song, and who is featured on it? Name at least one featured artist.',
   'Daft Punk — Get Lucky. Featured artists: Pharrell Williams and Nile Rodgers.',
   'The Groove. Award if they say Daft Punk + at least one of Pharrell / Nile Rodgers.'),
  (300, 'audio', 'Which two songs are mixed in this track? Name either the song titles or the artists.',
   'I Like To Move It — Reel 2 Real  &  Temperature — Sean Paul',
   'The Mashup. +50 bonus if both titles AND both artists.'),
  (400, 'audio', 'What year was this song released?', '2009',
   'The Night Club Banger (I Gotta Feeling — Black Eyed Peas). Year slider 2000–2010.'),
  (500, 'audio', 'Which country is this song from?', 'Italy',
   'The Origin (Freed From Desire). Teams can buy a private hint for 100 pts.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Guess the Artist')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvem er dette?', 'Kato',
   'Image question. Big Screen shows Kato_Billede1.jpg; reveal swaps to Kato_Billede2.jpg and plays a 15s clip.'),
  (200, 'audio', 'Hvem lavede dette nummer?', 'Elton John - Tiny Dancer',
   'Tiny Dancer plays on the Big Screen on open (max 120s). Reveal plays a separate 15s clip.'),
  (300, 'classic', 'Hvem åbnede Orange Scene i 2025?', 'Annika',
   'Text-only. Reveal plays "Blodigt (feat. Annika)" from 0:59 for 15s.'),
  (400, 'audio', 'Who did this song?', 'Swedish House Mafia & Coldplay - Every Teardrop is a Waterfall',
   'Plays from 1:08 for 60s on open. Reveal plays from 4:42 for 15s.'),
  (500, 'audio', 'Who did this song?', 'Queen - Fat Bottomed Girls',
   'Plays from 0:00 for 95s on open. Reveal plays from 2:15 for 15s.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Selected or Rejected')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'judgement', 'Stort statement-print til AW26: Selected eller Rejected?', 'Diskussion', 'Åben dialog.'),
  (200, 'judgement', 'En kampagne med kun ét farveunivers: Selected eller Rejected?', 'Diskussion', null),
  (300, 'judgement', 'Influencer-takeover på Instagram i en hel uge: Selected eller Rejected?', 'Diskussion', null),
  (400, 'judgement', 'AI-genererede modeller i kampagner: Selected eller Rejected?', 'Diskussion', 'Forvent debat.'),
  (500, 'risk', 'RISK: Pitch en helt ny kampagne-idé på 60 sekunder. Teams stemmer.', 'Bedste pitch vinder', 'Risk-felt — peer voting.')
) as v(points, type, prompt, answer, host_note);

with g as (select id from games where code = 'B2BTEAMDAY')
insert into game_state (game_id) select id from g;
