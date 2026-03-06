// v3.0.0 - DB-Only Settlement Engine (No API-Football)
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
 * Consolidates all specific card logic without overwriting previous work.
 * Events are read from the matches.events JSONB column — no external API calls.
 */
const calculateResult = (bet, match, events = []) => {
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

    // 3. PLAYER SCORE & SUPER SUB (Uses match events from DB)
    if (type.includes('player_score') || type.includes('supersub')) {
        const goals = events.filter(e => e.type === 'Goal');

        if (type.includes('player_score')) {
            const playerId = selection.split('_')[1];
            const didScore = goals.some(g => g.player.id?.toString() === playerId);
            return { status: didScore ? 'WON' : 'LOST' };
        }

        if (type.includes('supersub')) {
            const subScored = goals.some(g => g.detail === 'Substitution' || g.comments?.toLowerCase().includes('sub'));
            return { status: subScored ? 'WON' : 'LOST' };
        }
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

    // 2. Get unique match IDs and fetch match data from Supabase matches table
    const matchIds = [...new Set(activeBets.map(b => b.match_id))];
    const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, events')
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
        }
        // Settlement: FINISHED -> WON/LOST
        else if (isFinished(match.status)) {
            // Read events from the matches.events JSONB column (populated by Watcher)
            const events = Array.isArray(match.events) ? match.events : [];

            const result = calculateResult(bet, match, events);
            console.log(`✅ Settling ${bet.id}: ${result.status}`);
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

settle();