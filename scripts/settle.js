// v4.0.0 - DB-Only Settlement Engine
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Status classifications ──────────────────────────────────────────────────
const FINAL_STATUSES = ['FT', 'AET', 'PEN'];
const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE', 'BT'];
const VOID_STATUSES = ['PST', 'CANC', 'ABD', 'SUSP', 'INT', 'AWD', 'WO'];

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

    const isPlayerLevel = bet.player_id != null;
    const targetPlayerId = isPlayerLevel ? Number(bet.player_id) : null;

    // Step 1: Build a map of players who actually came on for the selected team.
    // In subst events, the incoming player is stored in `assist`.
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
        return { status: 'LOST', points: 0 };
    }

    // For player-level bets, the target player must be among the subs
    if (isPlayerLevel && !subsOnMap.has(targetPlayerId)) {
        return { status: 'LOST', points: 0 };
    }

    // Step 2: Check all goals scored by the selected team within 120 minutes.
    // Counts: Normal Goal, Penalty. Excludes: Own Goal, shootout (elapsed > 120).
    // A win triggers if the scorer OR the assister is a qualifying substitute.
    for (const event of events) {
        if (
            event.type === 'Goal' &&
            COUNTABLE_GOAL_DETAILS.includes(event.detail) &&
            event.team?.id === teamId &&
            (event.time?.elapsed ?? 0) <= 120
        ) {
            const goalTime = event.time?.elapsed ?? 0;
            const scorerId = event.player?.id;
            const assistId = event.assist?.id;

            // Check scorer
            if (scorerId != null) {
                const subOnTime = subsOnMap.get(scorerId);
                if (subOnTime !== undefined && goalTime >= subOnTime) {
                    if (isPlayerLevel) {
                        if (scorerId === targetPlayerId) {
                            console.log(`  ⚡ Supersub player-level win (goal): player ${scorerId} subbed on at ${subOnTime}', scored at ${goalTime}'`);
                            return { status: 'WON', points: 2500 };
                        }
                    } else {
                        console.log(`  ⚡ Supersub team-level win (goal): player ${scorerId} subbed on at ${subOnTime}', scored at ${goalTime}'`);
                        return { status: 'WON', points: 500 };
                    }
                }
            }

            // Check assister
            if (assistId != null) {
                const subOnTime = subsOnMap.get(assistId);
                if (subOnTime !== undefined && goalTime >= subOnTime) {
                    if (isPlayerLevel) {
                        if (assistId === targetPlayerId) {
                            console.log(`  ⚡ Supersub player-level win (assist): player ${assistId} subbed on at ${subOnTime}', assisted at ${goalTime}'`);
                            return { status: 'WON', points: 2500 };
                        }
                    } else {
                        console.log(`  ⚡ Supersub team-level win (assist): player ${assistId} subbed on at ${subOnTime}', assisted at ${goalTime}'`);
                        return { status: 'WON', points: 500 };
                    }
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
        // Prefer player_id column (migration 020); fall back to selection parsing
        let playerId;
        if (bet.player_id != null) {
            playerId = Number(bet.player_id);
        } else {
            // Legacy format: selection = 'PLAYER_<id>'
            const parts = selection.split('_');
            playerId = parts.length > 1 ? Number(parts[1]) : NaN;
        }

        if (isNaN(playerId)) {
            console.warn(`⚠️  Player Score bet ${bet.id} has no valid player ID — marking LOST`);
            return { status: 'LOST', points: 0 };
        }

        const didScore = events.some(
            e => e.type === 'Goal' &&
                COUNTABLE_GOAL_DETAILS.includes(e.detail) &&
                Number(e.player?.id) === playerId &&
                (e.time?.elapsed ?? 0) <= 90
        );

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
