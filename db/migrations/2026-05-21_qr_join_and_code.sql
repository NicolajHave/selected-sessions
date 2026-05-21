-- =====================================================================
-- Migration: join QR overlay + rename game code DEMO -> B2BTEAMDAY
-- Run once in the Supabase SQL Editor.
-- =====================================================================

-- 1. New flag the host toggles to show the join QR on the Big Screen.
alter table game_state
  add column if not exists show_join boolean not null default false;

-- 2. Rename the game code for the team day. The game row (teams, scores,
--    questions, state) is preserved — only the code changes.
update games set code = 'B2BTEAMDAY' where code = 'DEMO';
