// Aggressive string normalizer for Goalscorer matching
const normalizeName = (name) => {
    return String(name || '')
        .normalize('NFD') // Deconstruct special characters
        .replace(/[\u0300-\u036f]/g, '') // Strip accents (e.g., ü -> u)
        .toLowerCase()
        .replace(/^score_/, '') // Strip the legacy payload tag if present
        .replace(/[^a-z]/g, ''); // Erase all spaces, hyphens, and punctuation
};
// v4.0.0 - DB-Only Settlement Engine
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Status classifications ──────────────────────────────────────────────────
const FINAL_STATUSES = ['FT', 'AET', 'FT_PEN'];
const LIVE_STATUSES = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'];
const VOID_STATUSES = ['POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED', 'AWARDED', 'WO'];

const isFinished = (status) => FINAL_STATUSES.includes(status);
const isLive = (status) => LIVE_STATUSES.includes(status);
const isVoid = (status) => VOID_STATUSES.includes(status);

// ── Goal filter shared across card types ────────────────────────────────────
const COUNTABLE_GOAL_DETAILS = ['Normal Goal', 'Penalty'];

/**
 * SUPERSUB settlement logic.
 *
 * Win conditions — a player from the selected team who came off the bench:
 *   - Scores a goal (Normal Goal or Penalty, elapsed ≤ 120 — excludes shootout), OR
 *   - Assists a goal scored by the selected team (same filters)
 * ...at or after the minute they were substituted into the match.
 *
 * Points:
 *   - Team-level (bet.player_id is null): 500 points
 *   - Player-level (bet.player_id is set): 2500 points — ONLY if that specific player scored/assisted
 *
 * Data shape (from events array):
 *   subst event: { type: 'subst', team: { id }, player: { id } (coming OFF), assist: { id } (coming ON), time: { elapsed } }
 *   goal event:  { type: 'Goal',  team: { id }, player: { id } (scorer), assist: { id } (assister), detail, time: { elapsed } }
 *
 * Requires: bet.team_id (integer) — the team the user backed.
 */
export const settleSupersub = (bet, events) => {

    const teamId = bet.team_id;

    if (teamId == null) {
        console.warn(`⚠️  Supersub bet ${bet.id} has no team_id — cannot settle, marking LOST`);
        return { status: 'LOST', points: 0 };
    }

    // Step 1: Map players subbed ON for the backed team (type_id 18)
    const subsOnMap = new Map();
    for (const event of events) {
        const isSub = event.type_id === 18 || event.type === 'subst';
        const isBackedTeam = event.participant_id === teamId || event.team?.id === teamId;
        const incomingPlayerId = event.player_id || event.assist?.id;

        if (isSub && isBackedTeam && incomingPlayerId != null) {
            const minute = event.minute || event.time?.elapsed || 0;
            subsOnMap.set(incomingPlayerId, minute);
        }
    }

    if (subsOnMap.size === 0) return { status: 'LOST', points: 0 };

    // Step 2: Check if any of those specific subs scored a goal
    for (const event of events) {
        const isGoal = event.type_id === 14 || event.type_id === 97 || event.type === 'Goal';
        const isBackedTeam = event.participant_id === teamId || event.team?.id === teamId;
        const time = event.minute || event.time?.elapsed || 0;

        if (isGoal && isBackedTeam && time <= 120) {
            const scorerId = event.player_id || event.player?.id;

            if (scorerId != null) {
                const subOnTime = subsOnMap.get(scorerId);
                // Sub must have come on before or during the same minute as the goal
                if (subOnTime !== undefined && time >= subOnTime) {
                    console.log(`  ⚡ Supersub win: player ${scorerId} subbed on at ${subOnTime}', scored at ${time}'`);
                    return { status: 'WON', points: 500 };
                }
            }
        }
    }

    return { status: 'LOST', points: 0 };
};

/**
 * Main settlement logic for all card types.
 * Events are read from the matches.events JSONB column — no external API calls.
 *
 * Returns { status: 'PENDING' | 'WON' | 'LOST', points: number }
 */
export const calculateResult = (bet, match, events = []) => {
    if (!isFinished(match.status)) return { status: 'PENDING', points: 0 };

    const type = bet.card_type.toLowerCase();
    const selection = bet.selection;
    const homeGoals = match.home_score || 0;
    const awayGoals = match.away_score || 0;
    const totalGoals = homeGoals + awayGoals;
    const oddsPoints = Math.round((bet.odds || 0) * 100);

    // 1. MATCH RESULT
    if (type.includes('match_result')) {
        let outcome = 'DRAW';
        if (homeGoals > awayGoals) outcome = 'HOME_WIN';
        else if (awayGoals > homeGoals) outcome = 'AWAY_WIN';
        const won = selection === outcome;
        return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
    }

    // 2. TOTAL GOALS (2.5 Line)
    if (type.includes('total_goals')) {
        const isOver = totalGoals > 2.5;
        const predictedOver = selection.includes('OVER');
        const won = isOver === predictedOver;
        return { status: won ? 'WON' : 'LOST', points: won ? oddsPoints : 0 };
    }

    // 3. PLAYER SCORE — player must score a normal goal or penalty within 90 minutes
    if (type.includes('player_score')) {
        // Read directly from the existing `selection` column (e.g., "SCORE_Erling Haaland")
        const betPlayerName = normalizeName(bet.selection);

        if (!betPlayerName) {
            console.warn(`⚠️  Player Score bet ${bet.id} has no valid selection name — marking LOST`);
            return { status: 'LOST', points: 0 };
        }

        const didScore = events.some(e => {
            // Support Sportmonks v3 (14 = Goal, 97 = Penalty) or legacy string types
            const isGoal = e.type_id === 14 || e.type_id === 97 || e.type === 'Goal';
            const scorerName = normalizeName(e.player_name || e.player?.name);
            const time = e.minute || e.time?.elapsed || 0;

            return isGoal && scorerName === betPlayerName && time <= 90;
        });

        return { status: didScore ? 'WON' : 'LOST', points: didScore ? oddsPoints : 0 };
    }

    // 4. SUPERSUB
    if (type.includes('supersub')) {
        return settleSupersub(bet, events);
    }

    return { status: 'LOST', points: 0 };
};

// ── Orchestrator ────────────────────────────────────────────────────────────

async function settle() {
    console.log("\n🛰️  Starting DB-Only Settlement Engine v4.0...");

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

    // 2. Fetch match data — include events for settlement
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
    let voided = 0;

    for (const bet of activeBets) {
        const match = matchMap.get(bet.match_id);
        if (!match) {
            console.log(`⚠️  Bet ${bet.id}: match ${bet.match_id} not found in DB — skipping`);
            continue;
        }

        // Void: match cancelled/postponed/abandoned
        if (isVoid(match.status)) {
            const { error: voidErr } = await supabase.rpc('settle_prediction', {
                p_prediction_id: bet.id,
                p_new_status: 'LOST',
            });
            if (voidErr) console.error(`❌ Void error for bet ${bet.id}:`, voidErr.message);
            else console.log(`🚫 Bet ${bet.id} voided (match ${match.status})`);
            voided++;
            continue;
        }

        // Transition: PENDING -> LIVE
        if (bet.status === 'PENDING' && isLive(match.status)) {
            const { error: liveErr } = await supabase
                .from('predictions')
                .update({ status: 'LIVE' })
                .eq('id', bet.id);
            if (liveErr) console.error(`❌ LIVE transition error for bet ${bet.id}:`, liveErr.message);
            else console.log(`⏱️  Bet ${bet.id} is now LIVE`);
            transitioned++;
            continue;
        }

        // Settlement: FINISHED -> WON/LOST
        if (isFinished(match.status)) {
            const events = Array.isArray(match.events) ? match.events : [];
            const result = calculateResult(bet, match, events);

            console.log(`✅ Settling bet ${bet.id} (${bet.card_type}): ${result.status} — ${result.points} pts`);

            // Use settle_prediction RPC — handles coin payout atomically for WON bets
            const { error: settleErr } = await supabase.rpc('settle_prediction', {
                p_prediction_id: bet.id,
                p_new_status: result.status,
            });

            if (settleErr) {
                console.error(`❌ Settlement RPC error for bet ${bet.id}:`, settleErr.message);
                continue;
            }

            // Write points_awarded separately (RPC doesn't handle this yet)
            if (result.points > 0) {
                await supabase
                    .from('predictions')
                    .update({ points_awarded: result.points })
                    .eq('id', bet.id);
            }

            settled++;
        }
    }

    console.log(`\n🏁 Settlement complete — ${settled} settled, ${transitioned} transitioned to LIVE, ${voided} voided`);
}

// Guard: only auto-run when executed directly (not when imported by tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    settle();
}
