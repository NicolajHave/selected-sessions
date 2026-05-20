import { NextRequest, NextResponse } from 'next/server';
import { isHostAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  if (!isHostAuthenticated()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const code = params.code.toUpperCase();
  const body = await req.json();
  const { action } = body;

  // Look up game
  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: 'game not found' }, { status: 404 });
  }

  switch (action) {
    case 'select_question': {
      const { question_id } = body;
      const { data, error } = await supabaseAdmin
        .from('game_state')
        .update({
          current_question_id: question_id,
          answers_open: false,
          answer_revealed: false,
          show_leaderboard: false,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ gameState: data });
    }

    case 'back_to_board': {
      const { data, error } = await supabaseAdmin
        .from('game_state')
        .update({
          current_question_id: null,
          answers_open: false,
          answer_revealed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ gameState: data });
    }

    case 'set_answers_open': {
      const { open } = body;
      const { data, error } = await supabaseAdmin
        .from('game_state')
        .update({
          answers_open: !!open,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ gameState: data });
    }

    case 'set_revealed': {
      const { revealed } = body;
      const { data, error } = await supabaseAdmin
        .from('game_state')
        .update({
          answer_revealed: !!revealed,
          answers_open: revealed ? false : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ gameState: data });
    }

    case 'toggle_leaderboard': {
      const { show } = body;
      const { data, error } = await supabaseAdmin
        .from('game_state')
        .update({
          show_leaderboard: !!show,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ gameState: data });
    }

    case 'mark_answered': {
      const { question_id, answered } = body;
      const { error } = await supabaseAdmin
        .from('questions')
        .update({ is_answered: !!answered })
        .eq('id', question_id);

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case 'award_points': {
      const { team_id, points } = body;
      // Atomic update via raw select-then-update
      const { data: team, error: teamErr } = await supabaseAdmin
        .from('teams')
        .select('*')
        .eq('id', team_id)
        .single();

      if (teamErr || !team)
        return NextResponse.json({ error: 'team not found' }, { status: 404 });

      const newScore = team.score + Number(points);
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('teams')
        .update({ score: newScore })
        .eq('id', team_id)
        .select()
        .single();

      if (updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ team: updated });
    }

    case 'buy_hint': {
      // Subtract the hint cost from the team and record the purchase so the
      // team's own player screen can reveal the private hint.
      const { team_id, question_id, cost = 100 } = body;
      if (!team_id || !question_id)
        return NextResponse.json(
          { error: 'team_id and question_id required' },
          { status: 400 },
        );

      const { data: team, error: teamErr } = await supabaseAdmin
        .from('teams')
        .select('*')
        .eq('id', team_id)
        .single();
      if (teamErr || !team)
        return NextResponse.json({ error: 'team not found' }, { status: 404 });

      // Avoid double-charging if the hint was already bought for this question.
      const { data: existing } = await supabaseAdmin
        .from('team_question_hints')
        .select('id')
        .eq('team_id', team_id)
        .eq('question_id', question_id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ team, alreadyBought: true });
      }

      const { error: hintErr } = await supabaseAdmin
        .from('team_question_hints')
        .insert({
          game_id: game.id,
          team_id,
          question_id,
          hint_type: 'paid_hint',
          cost: Number(cost),
        });
      if (hintErr)
        return NextResponse.json({ error: hintErr.message }, { status: 500 });

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('teams')
        .update({ score: team.score - Number(cost) })
        .eq('id', team_id)
        .select()
        .single();
      if (updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 });

      return NextResponse.json({ team: updated, bought: true });
    }

    case 'reset_game': {
      // Wipe teams (submissions cascade), reopen every question, clear state.
      // Keeps the game row, categories and questions themselves intact.
      const { error: teamsErr } = await supabaseAdmin
        .from('teams')
        .delete()
        .eq('game_id', game.id);
      if (teamsErr)
        return NextResponse.json({ error: teamsErr.message }, { status: 500 });

      const { data: cats } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('game_id', game.id);
      const categoryIds = (cats ?? []).map((c) => c.id);
      if (categoryIds.length > 0) {
        const { error: qErr } = await supabaseAdmin
          .from('questions')
          .update({ is_answered: false })
          .in('category_id', categoryIds);
        if (qErr)
          return NextResponse.json({ error: qErr.message }, { status: 500 });
      }

      const { data: state, error: stateErr } = await supabaseAdmin
        .from('game_state')
        .update({
          current_question_id: null,
          answers_open: false,
          answer_revealed: false,
          show_leaderboard: false,
          updated_at: new Date().toISOString(),
        })
        .eq('game_id', game.id)
        .select()
        .single();
      if (stateErr)
        return NextResponse.json({ error: stateErr.message }, { status: 500 });

      return NextResponse.json({ gameState: state, reset: true });
    }

    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
