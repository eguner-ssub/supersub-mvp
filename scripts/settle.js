// v3.2.0 - DB-Only Settlement Engine (No API-Football)
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const isFinished = (status) => FINAL_STATUSES.includes(status);
const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);

/**
 * SUPERSUB settlement logic.
 *
 * A bet wins if any player from the selected team who came off the bench:
 *   - Scores a goal (Normal Goal or Penalty, elapsed ≤ 120 — excludes shootout), OR
 *   - Assists a goal scored by the selected team (Normal Goal or Penalty, elapsed ≤ 120)
 * ...after being substituted into the match.
 *
 * Data shape (from API-Football events array):
 *   subst event: { type: 'subst', team: { id }, player: { id } (coming OFF), assist: { id } (coming ON), time: { elapsed } }
 *   goal event:  { type: 'Goal',  team: { id }, player: { id } (scorer), assist: { id } (assister), detail, time: { elapsed } }
 *
 * Requires: bet.team_id (integer) — the team the user backed.
 */
export const settleSupersub = (bet, events) => {
    const teamId = bet.team_id;

    if (!teamId) {
        console.warn(`⚠️  Supersub bet ${bet.id} has no team_id — cannot settle, marking LOST`);
        return { status: 'LOST' };
    }

    // Step 1: Build a map of players who actually came on for the selected team.
    // In API-Football subst events, the incoming player is stored in `assist`.
    // Map: playerId -> elapsed minute they came on.
    const subsOnMap = new Map();
    for (const event of events) {
        if (
            event.type === 'subst' &&
            event.team?.id === teamId &&
            event.assist?.id != null
        ) {
            subsOnMap.set(event.assist.id, event.time?.elapsed ?? 0);
        }
    }

    if (subsOnMap.size === 0) {
        // No substitutions made for this team — can't win
        return { status: 'LOST' };
    }

    // Step 2: Check all goals scored by the selected team within 120 minutes.
    // Counts: Normal Goal, Penalty. Excludes: Own Goal, shootout (elapsed > 120).
    // A win triggers if the scorer OR the assister is a substitute who came on before the goal.
    const countableDetails = ['Normal Goal', 'Penalty'];

    for (const event of events) {
        if (
            event.type === 'Goal' &&
            countableDetails.includes(event.detail) &&
            event.team?.id === teamId &&
            (event.time?.elapsed ?? 0) <= 120
        ) {
            const goalTime = event.time?.elapsed ?? 0;
            const scorerId = event.player?.id;
            const assistId = event.assist?.id;

            // Check scorer
            if (scorerId != null) {
                const subOnTime = subsOnMap.get(scorerId);
                if (subOnTime !== undefined && goalTime > subOnTime) {
                    console.log(`  ⚡ Supersub win (goal): player ${scorerId} subbed on at ${subOnTime}', scored at ${goalTime}'`);
                    return { status: 'WON' };
                }
            }

            // Check assister
            if (assistId != null) {
                const subOnTime = subsOnMap.get(assistId);
                if (subOnTime !== undefined && goalTime > subOnTime) {
                    console.log(`  ⚡ Supersub win (assist): player ${assistId} subbed on at ${subOnTime}', assisted at ${goalTime}'`);
                    return { status: 'WON' };
                }
            }
        }
    }

    return { status: 'LOST' };
};

/**
 * Main settlement logic for all card types.
 * Events are read from the matches.events JSONB column — no external API calls.
 */
export const calculateResult = (bet, match, events = []) => {
    if (!isFinished(match.status)) return { status: 'PENDING' };

    const type = bet.card_type.toLowerCase();
    const selection = bet.selection;
    const homeGoals = match.home_score || 0;
    const awayGoals = match.away_score || 0;
    const totalGoals = homeGoals + awayGoals;

    // 1. MATCH RESULT
    if (type.includes('match_result')) {
        let outcome = 'DRAW';
        if (homeGoals > awayGoals) outcome = 'HOME_WIN';
        else if (awayGoals > homeGoals) outcome = 'AWAY_WIN';
        return { status: selection === outcome ? 'WON' : 'LOST' };
    }

    // 2. TOTAL GOALS (2.5 Line)
    if (type.includes('total_goals')) {
        const isOver = totalGoals > 2.5;
        const predictedOver = selection.includes('OVER');
        return { status: isOver === predictedOver ? 'WON' : 'LOST' };
    }

    // 3. PLAYER SCORE
    if (type.includes('player_score')) {
        const playerId = selection.split('_')[1];
        const didScore = events.some(
            e => e.type === 'Goal' &&
                e.detail === 'Normal Goal' &&
                e.player?.id?.toString() === playerId
        );
        return { status: didScore ? 'WON' : 'LOST' };
    }

    // 4. SUPERSUB
    if (type.includes('supersub')) {
        return settleSupersub(bet, events);
    }

    return { status: 'LOST' };
};

async function settle() {
    console.log("\n🛰️  Starting DB-Only Settlement Engine...");

    // 1. Find active bets (PENDING or LIVE)
    const { data: activeBets, error: betsErr } = await supabase
        .from('predictions')
        .select('*')
        .in('status', ['PENDING', 'LIVE']);

    if (betsErr) {
        console.error("❌ Failed to fetch predictions:", betsErr.message);
        return;
    }

    if (!activeBets?.length) {
        console.log("📭 No active bets — nothing to settle.");
        return;
    }

    console.log(`📋 Found ${activeBets.length} active bet(s)`);

    // 2. Fetch match data — include lineups for Supersub cross-reference
    const matchIds = [...new Set(activeBets.map(b => b.match_id))];
    const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, events, lineups')
        .in('id', matchIds);

    if (matchErr) {
        console.error("❌ Failed to fetch matches:", matchErr.message);
        return;
    }

    console.log(`⚽ Fetched ${matches?.length || 0} match(es) from DB`);

    const matchMap = new Map((matches || []).map(m => [m.id, m]));

    // 3. Settle each bet
    let settled = 0;
    let transitioned = 0;

    for (const bet of activeBets) {
        const match = matchMap.get(bet.match_id);
        if (!match) {
            console.log(`⚠️  Bet ${bet.id}: match ${bet.match_id} not found in DB — skipping`);
            continue;
        }

        // Transition: PENDING -> LIVE
        if (bet.status === 'PENDING' && isLive(match.status)) {
            await supabase.from('predictions').update({ status: 'LIVE' }).eq('id', bet.id);
            console.log(`⏱️  Bet ${bet.id} is now LIVE`);
            transitioned++;
            continue;
        }

        // Settlement: FINISHED -> WON/LOST
        if (isFinished(match.status)) {
            const events = Array.isArray(match.events) ? match.events : [];
            const result = calculateResult(bet, match, events);

            console.log(`✅ Settling bet ${bet.id} (${bet.card_type}): ${result.status}`);
            await supabase.from('predictions').update({ status: result.status }).eq('id', bet.id);
            settled++;

            if (result.status === 'WON') {
                await supabase.rpc('payout_user', { p_user_id: bet.user_id, p_amount: bet.potential_reward });
                console.log(`💰 Payout: ${bet.potential_reward} to user ${bet.user_id}`);
            }
        }
    }

    console.log(`\n🏁 Settlement complete — ${settled} settled, ${transitioned} transitioned to LIVE`);
}

// Guard: only auto-run when executed directly (not when imported by tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    settle();
}