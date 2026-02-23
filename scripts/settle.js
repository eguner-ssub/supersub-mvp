// v2.5.0 - Final Consolidated Settlement Engine
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { LEAGUE_COVERAGE } from '../src/shared/config/coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.FOOTBALL_API_KEY;

const isFinished = (status) => ['FT', 'AET', 'PEN'].includes(status);
const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);

/**
 * Consolidates all specific card logic without overwriting previous work
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

    // 3. PLAYER SCORE & SUPER SUB (Requires Match Events)
    if (type.includes('player_score') || type.includes('supersub')) {
        const goals = events.filter(e => e.type === 'Goal');

        if (type.includes('player_score')) {
            const playerId = selection.split('_')[1];
            const didScore = goals.some(g => g.player.id?.toString() === playerId);
            return { status: didScore ? 'WON' : 'LOST' };
        }

        if (type.includes('supersub')) {
            // Checks for 'Substitution' in goal details or comments
            const subScored = goals.some(g => g.detail === 'Substitution' || g.comments?.toLowerCase().includes('sub'));
            return { status: subScored ? 'WON' : 'LOST' };
        }
    }

    return { status: 'LOST' };
};

async function syncLeaguesAndSettle() {
    console.log("\n🛰️  Starting Smart Settlement Engine...");

    // 1. DYNAMIC SYNC WINDOW: 7 Days (-3 to +3)
    const leagueIds = Object.values(LEAGUE_COVERAGE).map(l => l.id);
    const dateRange = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 3 + i);
        return d.toISOString().split('T')[0];
    });

    for (const date of dateRange) {
        console.log(`📅 Syncing: ${date}`);
        for (const leagueId of leagueIds) {
            try {
                const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&date=${date}`, {
                    headers: { 'x-apisports-key': API_KEY }
                });
                const { response } = await res.json();

                if (response?.length > 0) {
                    const updates = response.map(m => ({
                        match_id: m.fixture.id,
                        league_id: leagueId,
                        match_date: m.fixture.date.split('T')[0],
                        status: m.fixture.status.short,
                        home_score: m.goals.home ?? 0,
                        away_score: m.goals.away ?? 0,
                        elapsed: m.fixture.status.elapsed ?? 0,
                        updated_at: new Date()
                    }));
                    await supabase.from('matches_live').upsert(updates);
                }
            } catch (err) {
                console.error(`❌ League ${leagueId} failed on ${date}:`, err.message);
            }
        }
    }

    // 2. SETTLE ACTIVE BETS
    const { data: activeBets } = await supabase.from('predictions').select('*').in('status', ['PENDING', 'LIVE']);
    if (!activeBets?.length) return console.log("📭 No active bets.");

    const matchIds = [...new Set(activeBets.map(b => b.match_id))];
    const { data: cachedMatches } = await supabase.from('matches_live').select('*').in('match_id', matchIds);

    for (const bet of activeBets) {
        const match = cachedMatches?.find(m => m.match_id === bet.match_id);
        if (!match) continue;

        // Transition: PENDING -> LIVE
        if (bet.status === 'PENDING' && isLive(match.status)) {
            await supabase.from('predictions').update({ status: 'LIVE' }).eq('id', bet.id);
            console.log(`⏱️  Bet ${bet.id} is now LIVE`);
        }
        // Settlement: FINISHED -> WON/LOST
        else if (isFinished(match.status)) {
            let events = [];
            // Only fetch events for complex cards to save API calls
            if (bet.card_type !== 'c_match_result') {
                const eventRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${match.match_id}`, {
                    headers: { 'x-apisports-key': API_KEY }
                });
                const eventData = await eventRes.json();
                events = eventData.response || [];
            }

            const result = calculateResult(bet, match, events);
            console.log(`✅ Settling ${bet.id}: ${result.status}`);
            await supabase.from('predictions').update({ status: result.status }).eq('id', bet.id);

            if (result.status === 'WON') {
                await supabase.rpc('payout_user', { p_user_id: bet.user_id, p_amount: bet.potential_reward });
            }
        }
    }
}

syncLeaguesAndSettle();