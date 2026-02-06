import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const API_FOOTBALL_KEY = process.env.VITE_API_FOOTBALL_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !API_FOOTBALL_KEY) {
    console.error("❌ ERROR: Missing required API keys. Check .env.local");
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Calculates result based on match data
 */
const calculateResult = (cardType, selection, matchData) => {
    const status = matchData.fixture?.status?.short?.toUpperCase();
    const isFinished = ['FT', 'AET', 'PEN'].includes(status);

    if (!isFinished) return { status: 'PENDING' };

    const homeGoals = matchData.goals?.home || 0;
    const awayGoals = matchData.goals?.away || 0;
    const events = matchData.events || [];
    const lineups = matchData.lineups || [];

    // LEGACY FIX: Fallback to match_result if cardType is null
    const type = (cardType || 'c_match_result').toLowerCase();

    // A. MATCH RESULT
    if (type.includes('match_result') || type.includes('match_winner')) {
        let actualOutcome = 'DRAW';
        if (homeGoals > awayGoals) actualOutcome = 'HOME_WIN';
        else if (awayGoals > homeGoals) actualOutcome = 'AWAY_WIN';

        return { status: selection === actualOutcome ? 'WON' : 'LOST' };
    }

    // B. TOTAL GOALS
    if (type.includes('total_goals')) {
        const total = homeGoals + awayGoals;
        const isOver = total > 2.5;
        const pickedOver = selection.includes('Over');
        return { status: (pickedOver === isOver) ? 'WON' : 'LOST' };
    }

    // C. SUPERSUB
    if (type.includes('supersub')) {
        const benchIds = new Set();
        lineups.forEach(team => {
            team.substitutes?.forEach(sub => {
                if (sub.player?.id) benchIds.add(sub.player.id);
            });
        });
        const subScored = events.some(e => e.type === 'Goal' && e.detail !== 'Missed Penalty' && benchIds.has(e.player?.id));
        return { status: subScored ? 'WON' : 'LOST' };
    }

    return { status: 'LOST' };
};

async function runSettlement() {
    console.log("\n🎰 --- STARTING BACKEND SETTLEMENT ---");

    const { data: bets, error } = await supabase.from('predictions').select('*').eq('status', 'PENDING');

    if (error || !bets || bets.length === 0) {
        console.log("📭 No pending bets to settle.");
        return;
    }

    const uniqueMatchIds = [...new Set(bets.map(b => b.match_id))];
    console.log(`📋 Found ${bets.length} bets across ${uniqueMatchIds.length} matches.`);

    for (const matchId of uniqueMatchIds) {
        try {
            const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
                headers: { 'x-rapidapi-key': API_FOOTBALL_KEY }
            });
            const data = await res.json();
            const matchData = data.response?.[0];

            if (!matchData) continue;

            const status = matchData.fixture.status.short;
            const matchName = `${matchData.teams.home.name} vs ${matchData.teams.away.name}`;

            if (!['FT', 'AET', 'PEN'].includes(status)) {
                console.log(`   ⏳ [${status}] ${matchName}: Waiting for full time.`);
                continue;
            }

            console.log(`   ✅ [${status}] ${matchName}: Processing settlement...`);

            const matchBets = bets.filter(b => b.match_id === matchId);
            for (const bet of matchBets) {
                const result = calculateResult(bet.card_type, bet.selection, matchData);

                if (result.status !== 'PENDING') {
                    console.log(`      📝 Bet ${bet.id} (${bet.selection}): ${result.status}`);

                    await supabase.from('predictions').update({ status: result.status }).eq('id', bet.id);

                    if (result.status === 'WON') {
                        // RPC Call Fixed: Matches parameters in the SQL function
                        const { error: payoutErr } = await supabase.rpc('payout_user', {
                            p_user_id: bet.user_id,
                            p_amount: bet.potential_reward
                        });

                        if (payoutErr) console.error(`      ❌ Payout failed: ${payoutErr.message}`);
                        else console.log(`      💰 Payout Success: ${bet.potential_reward} coins.`);
                    }
                }
            }
        } catch (err) {
            console.error(`   ❌ Error fetching match ${matchId}:`, err.message);
        }
    }
    console.log("\n🏁 --- SETTLEMENT RUN COMPLETE ---\n");
}

runSettlement();