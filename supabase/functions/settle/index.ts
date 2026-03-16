import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Status classifications ───────────────────────────────────────────────────
const FINAL_STATUSES = ['FT', 'AET', 'FT_PEN'];
const LIVE_STATUSES  = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];
const VOID_STATUSES  = ['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED', 'AWARDED', 'WO'];

const isFinished = (s: string) => FINAL_STATUSES.includes(s);
const isLive     = (s: string) => LIVE_STATUSES.includes(s);
const isVoid     = (s: string) => VOID_STATUSES.includes(s);

// ── Name normalizer (mirrored from scripts/settle.js) ───────────────────────
const normalizeName = (name: string | null | undefined): string =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^score_/, '')
    .replace(/[^a-z]/g, '');

// ── SUPERSUB settlement ──────────────────────────────────────────────────────
function settleSupersub(bet: any, events: any[]): { status: string; points: number } {
  const teamId = bet.team_id;

  if (teamId == null) {
    console.warn(`⚠️  Supersub bet ${bet.id} has no team_id — marking LOST`);
    return { status: 'LOST', points: 0 };
  }

  const subsOnMap = new Map<number, number>();
  for (const event of events) {
    const isSub           = event.type_id === 18 || event.type === 'subst';
    const isBackedTeam    = event.participant_id === teamId || event.team?.id === teamId;
    const incomingPlayerId = event.player_id || event.assist?.id;

    if (isSub && isBackedTeam && incomingPlayerId != null) {
      subsOnMap.set(incomingPlayerId, event.minute || event.time?.elapsed || 0);
    }
  }

  if (subsOnMap.size === 0) return { status: 'LOST', points: 0 };

  for (const event of events) {
    const isGoal       = event.type_id === 14 || event.type_id === 97 || event.type === 'Goal';
    const isBackedTeam = event.participant_id === teamId || event.team?.id === teamId;
    const time         = event.minute || event.time?.elapsed || 0;

    if (isGoal && isBackedTeam && time <= 120) {
      const scorerId  = event.player_id || event.player?.id;
      const subOnTime = scorerId != null ? subsOnMap.get(scorerId) : undefined;

      if (subOnTime !== undefined && time >= subOnTime) {
        console.log(`  ⚡ Supersub win: player ${scorerId} subbed on at ${subOnTime}', scored at ${time}'`);
        return { status: 'WON', points: 500 };
      }
    }
  }

  return { status: 'LOST', points: 0 };
}

// ── Main settlement logic (mirrored from scripts/settle.js) ─────────────────
function calculateResult(bet: any, match: any, events: any[] = []): { status: string; points: number } {
  if (!isFinished(match.status)) return { status: 'PENDING', points: 0 };

  const type       = bet.card_type.toLowerCase();
  const selection  = bet.selection;
  const homeGoals  = match.home_score || 0;
  const awayGoals  = match.away_score || 0;
  const oddsPoints = Math.round((bet.odds || 0) * 100);

  if (type.includes('match_result')) {
    let outcome = 'DRAW';
    if (homeGoals > awayGoals)      outcome = 'HOME_WIN';
    else if (awayGoals > homeGoals) outcome = 'AWAY_WIN';
    const won = selection === outcome;
    return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
  }

  if (type.includes('total_goals')) {
    const won = (selection.includes('OVER')) === (homeGoals + awayGoals > 2.5);
    return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
  }

  if (type.includes('player_score')) {
    const betPlayerName = normalizeName(bet.selection);
    if (!betPlayerName) {
      console.warn(`⚠️  Player Score bet ${bet.id} has no valid selection — marking LOST`);
      return { status: 'LOST', points: 0 };
    }
    const didScore = events.some(e => {
      const isGoal     = e.type_id === 14 || e.type_id === 97 || e.type === 'Goal';
      const scorerName = normalizeName(e.player_name || e.player?.name);
      const time       = e.minute || e.time?.elapsed || 0;
      return isGoal && scorerName === betPlayerName && time <= 90;
    });
    return { status: didScore ? 'WON' : 'LOST', points: didScore ? oddsPoints : 0 };
  }

  if (type.includes('supersub')) {
    return settleSupersub(bet, events);
  }

  return { status: 'LOST', points: 0 };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
async function settle(supabase: ReturnType<typeof createClient>) {
  const result = { settled: 0, transitioned: 0, voided: 0, errors: [] as string[] };

  // 1. Fetch all open bets
  const { data: activeBets, error: betsErr } = await supabase
    .from('predictions')
    .select('*')
    .in('status', ['PENDING', 'LIVE']);

  if (betsErr) {
    result.errors.push(`Failed to fetch predictions: ${betsErr.message}`);
    return result;
  }

  if (!activeBets?.length) {
    console.log('📭 No active bets — nothing to settle.');
    return result;
  }

  console.log(`📋 Found ${activeBets.length} active bet(s)`);

  // 2. Fetch the relevant matches in one query
  const matchIds = [...new Set(activeBets.map((b: any) => b.match_id))];
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, home_score, away_score, events, lineups')
    .in('id', matchIds);

  if (matchErr) {
    result.errors.push(`Failed to fetch matches: ${matchErr.message}`);
    return result;
  }

  console.log(`⚽ Fetched ${matches?.length || 0} match(es)`);

  const matchMap = new Map((matches || []).map((m: any) => [m.id, m]));

  // 3. Process each bet
  for (const bet of activeBets) {
    const match = matchMap.get(bet.match_id);
    if (!match) {
      console.log(`⚠️  Bet ${bet.id}: match ${bet.match_id} not in DB — skipping`);
      continue;
    }

    // Void bets for cancelled/postponed matches
    if (isVoid(match.status)) {
      const { error } = await supabase.rpc('settle_prediction', {
        p_prediction_id: bet.id,
        p_new_status: 'LOST',
      });
      if (error) result.errors.push(`Void error for bet ${bet.id}: ${error.message}`);
      else { console.log(`🚫 Bet ${bet.id} voided (match ${match.status})`); result.voided++; }
      continue;
    }

    // Transition PENDING → LIVE on kick-off
    if (bet.status === 'PENDING' && isLive(match.status)) {
      const { error } = await supabase
        .from('predictions')
        .update({ status: 'LIVE' })
        .eq('id', bet.id);
      if (error) result.errors.push(`LIVE transition error for bet ${bet.id}: ${error.message}`);
      else { console.log(`⏱️  Bet ${bet.id} → LIVE`); result.transitioned++; }
      continue;
    }

    // Settle finished matches
    if (isFinished(match.status)) {
      const events    = Array.isArray(match.events) ? match.events : [];
      const calcResult = calculateResult(bet, match, events);

      console.log(`✅ Bet ${bet.id} (${bet.card_type}): ${calcResult.status} — ${calcResult.points} pts`);

      const { error: settleErr } = await supabase.rpc('settle_prediction', {
        p_prediction_id: bet.id,
        p_new_status: calcResult.status,
      });

      if (settleErr) {
        result.errors.push(`Settlement RPC error for bet ${bet.id}: ${settleErr.message}`);
        continue;
      }

      if (calcResult.points > 0) {
        await supabase
          .from('predictions')
          .update({ points_awarded: calcResult.points })
          .eq('id', bet.id);
      }

      result.settled++;
    }
  }

  return result;
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log('\n🛰️  Settlement Engine — invocation start');
  const result = await settle(supabase);
  console.log(`\n🏁 Done — ${result.settled} settled, ${result.transitioned} → LIVE, ${result.voided} voided`);

  return new Response(JSON.stringify(result), {
    status: result.errors.length === 0 ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  });
});
