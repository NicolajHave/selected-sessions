-- ============================================
-- Seed: Standard Selected Sessions quiz
-- Run after schema.sql
-- ============================================

insert into games (code, status) values ('DEMO', 'lobby');

with g as (select id from games where code = 'DEMO')
insert into categories (game_id, name, position)
select g.id, name, position from g, (values
  ('Campaign Moodboard', 0),
  ('Office Anthems', 1),
  ('Brand Space Bangers', 2),
  ('Guess the Artist', 3),
  ('Selected or Rejected', 4)
) as v(name, position);

with c as (select id from categories where name = 'Campaign Moodboard')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvilket årti forbindes mest med Calvin Kleins ikoniske underwear-kampagner?', '1990''erne', 'Klassisk opvarmer.'),
  (200, 'audio', 'Navngiv kunstneren bag denne track.', 'Dua Lipa', 'Afspil 10 sek. fra "Levitating".'),
  (300, 'lyric', 'Færdiggør lyrikken: "We found love in a..."', 'hopeless place', 'Rihanna — alle bør kunne den her.'),
  (400, 'judgement', 'En ny kampagne lanceres med en ekstremt kontroversiel kunstner. Brand fit eller no-go?', 'Diskussion — host vurderer', 'Åben for debat. Bedste begrundelse vinder.'),
  (500, 'risk', 'RISK: Navngiv 5 modemærker der har samarbejdet med musikartister i 2024.', 'Eksempler: Loewe x Charli XCX, Skims x Usher, Marc Jacobs x Charli, etc.', 'Risk-felt: alt eller intet.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Office Anthems')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvilken kunstner står bag "Bad Guy"?', 'Billie Eilish', null),
  (200, 'audio', 'Hvilken sang er det her?', 'Blinding Lights — The Weeknd', 'Afspil intro.'),
  (300, 'lyric', 'Færdiggør: "Is this the real life? Is this just..."', 'fantasy', 'Bohemian Rhapsody.'),
  (400, 'classic', 'Hvilken dansk artist vandt et Grammy i 2024?', 'MØ (eller relevant aktuelt svar — host justerer)', 'Tjek aktuelle vindere før dagen.'),
  (500, 'risk', 'RISK: Nævn 3 sange der har været #1 i Danmark de seneste 12 måneder.', 'Host vurderer baseret på aktuelle hitlister', 'Risk-felt.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Brand Space Bangers')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'classic', 'Hvilken sang spilles oftest i Selected showrooms? (host bestemmer)', 'Host''s call', 'Sjov åbner.'),
  (200, 'audio', 'Genkend denne showroom-klassiker.', 'Host indsætter senere', 'Lydfil tilføjes senere.'),
  (300, 'judgement', 'Skal vi spille mere house eller mere indie i showroomet?', 'Diskussion — bedste argument vinder', 'Lad teams pitche.'),
  (400, 'classic', 'Hvilken kunstner har optrådt på flest fashion week afterparties i 2024?', 'Eksempel: Charli XCX', 'Host justerer.'),
  (500, 'risk', 'RISK: Lav en 30-sekunders pitch til en ny showroom-playlist.', 'Host vurderer', 'Risk-felt — kreativitet belønnes.')
) as v(points, type, prompt, answer, host_note);

with c as (select id from categories where name = 'Guess the Artist')
insert into questions (category_id, points, type, prompt, answer, host_note)
select c.id, points, type::question_type, prompt, answer, host_note from c, (values
  (100, 'audio', 'Hvem synger dette?', 'Host indsætter', 'Nem opvarmer.'),
  (200, 'audio', 'Hvilken artist er dette?', 'Host indsætter', null),
  (300, 'classic', 'Denne artist har samarbejdet med både Versace og Loewe. Hvem?', 'Eksempel: Beyoncé', 'Host justerer.'),
  (400, 'audio', 'Identificér artisten på 3 sekunder.', 'Host indsætter', 'Lyninstinkt.'),
  (500, 'risk', 'RISK: Navngiv artisten ud fra ét enkelt billede (uden lyd).', 'Host indsætter', 'Visuelt risk-felt.')
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

with g as (select id from games where code = 'DEMO')
insert into game_state (game_id) select id from g;
