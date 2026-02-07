// v2.0.0 - Optimized League-Based Sync
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { LEAGUE_COVERAGE } from '../src/shared/config/coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.VITE_API_FOOTBALL_KEY;

const isFinished = (status) => ['FT', 'AET', 'PEN'].includes(status);
const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);

/**
 * Calculates result based on cached match data
 */
const calculateResult = (cardType, selection, match) => {
    if (!isFinished(match.status)) return { status: 'PENDING' };

    const type = (cardType || 'c_match_result').toLowerCase();

    if (type.includes('match_result')) {
        let outcome = 'DRAW';
        if (match.home_score > match.away_score) outcome = 'HOME_WIN';
        else if (match.away_score > match.home_score) outcome = 'AWAY_WIN';
        return { status: selection === outcome ? 'WON' : 'LOST' };
    }
    // Add other card logic here...
    return { status: 'LOST' };
};

async function syncLeaguesAndSettle() {
    console.log("\n🛰️ --- STARTING LEAGUE SYNC & SETTLEMENT ---");
    const today = new Date().toISOString().split('T')[0];
    const leagueIds = Object.values(LEAGUE_COVERAGE).map(l => l.id);

    // 1. BULK FETCH LEAGUE DATA (1 call per league, not per bet)
    for (const leagueId of leagueIds) {
        try {
            console.log(`📡 Fetching League ID: ${leagueId}...`);
            const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&date=${today}`, {
                headers: { 'x-rapidapi-key': API_KEY }
            });
            const { response } = await res.json();

            if (!response || response.length === 0) continue;

            // 2. UPDATE MATCH CACHE
            const matchUpdates = response.map(m => ({
                match_id: m.fixture.id,
                league_id: leagueId,
                status: m.fixture.status.short,
                home_score: m.goals.home ?? 0,
                away_score: m.goals.away ?? 0,
                elapsed: m.fixture.status.elapsed ?? 0,
                updated_at: new Date()
            }));

            await supabase.from('matches_live').upsert(matchUpdates);
        } catch (err) {
            console.error(`❌ Sync failed for league ${leagueId}:`, err.message);
        }
    }

    // 3. SETTLE BETS AGAINST CACHE (No more API calls here)
    const { data: activeBets } = await supabase
        .from('predictions')
        .select('*')
        .in('status', ['PENDING', 'LIVE']);

    if (!activeBets || activeBets.length === 0) {
        console.log("📭 No active bets to process.");
        return;
    }

    // Fetch match data from our LOCAL cache
    const matchIds = [...new Set(activeBets.map(b => b.match_id))];
    const { data: cachedMatches } = await supabase
        .from('matches_live')
        .select('*')
        .in('match_id', matchIds);

    for (const bet of activeBets) {
        const match = cachedMatches?.find(m => m.match_id === bet.match_id);
        if (!match) continue;

        // Transition PENDING -> LIVE
        if (bet.status === 'PENDING' && isLive(match.status)) {
            console.log(`⏱️ Bet ${bet.id} is now LIVE`);
            await supabase.from('predictions').update({ status: 'LIVE' }).eq('id', bet.id);
        }
        // Settlement FT -> WON/LOST
        else if (isFinished(match.status)) {
            const result = calculateResult(bet.card_type, bet.selection, match);
            console.log(`✅ Settling Bet ${bet.id}: ${result.status}`);
            await supabase.from('predictions').update({ status: result.status }).eq('id', bet.id);
            if (result.status === 'WON') {
                await supabase.rpc('payout_user', { p_user_id: bet.user_id, p_amount: bet.potential_reward });
            }
        }
    }
    console.log("🏁 --- RUN COMPLETE ---");
}

syncLeaguesAndSettle();