import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Lazy Supabase Client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
    if (_client) return _client;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
        );
    }

    _client = createClient(url, key);
    return _client;
}

// ── Transform ─────────────────────────────────────────────────────────────────
//
// Sportmonks stores lineups as a flat array (all players across both teams):
//   { team_id, type_id (11=starter / 12=bench), jersey_number, player_id,
//     player_name, formation_field ("row:col") }
//
// MatchLineup.jsx expects API-Football-style per-team objects:
//   { team: { id, name, logo }, formation: "4-3-3",
//     startXI: [{ player: { id, name, number, pos, grid } }],
//     substitutes: [{ player: { id, name, number } }] }
//
// Home/Away split: Sportmonks returns home team players first in the array,
// so the first distinct team_id encountered = home, second = away.

function transformLineups(flatLineups, matchRow) {
    if (!flatLineups || !Array.isArray(flatLineups) || flatLineups.length === 0) return [];

    // Collect unique team_ids in first-seen order (home first per Sportmonks convention)
    const teamIds = [];
    for (const entry of flatLineups) {
        if (entry.team_id != null && !teamIds.includes(entry.team_id)) {
            teamIds.push(entry.team_id);
            if (teamIds.length === 2) break;
        }
    }

    if (teamIds.length < 2) return [];

    const [homeId, awayId] = teamIds;

    const buildTeam = (teamId, teamName, teamLogo) => {
        const players  = flatLineups.filter(e => e.team_id === teamId);
        const starters = players.filter(e => e.type_id === 11);
        const subs     = players.filter(e => e.type_id === 12);

        // Derive formation string from starters' formation_field ("row:col").
        // Row 1 = GK; rows 2+ = outfield lines counted per row.
        let formation = null;
        if (starters.some(e => e.formation_field)) {
            const rowCounts = {};
            for (const e of starters) {
                if (e.formation_field) {
                    const row = parseInt(e.formation_field.split(':')[0], 10) || 1;
                    rowCounts[row] = (rowCounts[row] || 0) + 1;
                }
            }
            const outfieldRows = Object.keys(rowCounts)
                .map(Number)
                .filter(r => r > 1)
                .sort((a, b) => a - b)
                .map(r => rowCounts[r]);
            if (outfieldRows.length > 0) formation = outfieldRows.join('-');
        }

        return {
            team: { id: teamId, name: teamName || 'Team', logo: teamLogo || null },
            formation: formation || '4-4-2',
            startXI: starters.map(e => ({
                player: {
                    id:     e.player_id || null,
                    name:   e.player_name || 'Unknown',
                    number: e.jersey_number || '',
                    pos:    null,
                    // formation_field ("row:col") maps directly to the grid string
                    // consumed by MatchLineup's parseGrid / mapFormation helpers.
                    grid:   e.formation_field || null,
                },
            })),
            substitutes: subs.map(e => ({
                player: {
                    id:     e.player_id || null,
                    name:   e.player_name || 'Unknown',
                    number: e.jersey_number || '',
                },
            })),
        };
    };

    return [
        buildTeam(homeId, matchRow?.home_team, matchRow?.home_logo),
        buildTeam(awayId, matchRow?.away_team, matchRow?.away_logo),
    ];
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    const { fixture } = req.query;

    if (!fixture) {
        return res.status(400).json({ error: "Missing 'fixture' query parameter" });
    }

    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('matches')
            .select('id, home_team, away_team, home_logo, away_logo, lineups')
            .eq('id', Number(fixture))
            .single();

        if (error) {
            console.error(`❌ [Lineups API] Supabase error:`, error.message);
            return res.status(500).json({ response: [], error: error.message });
        }

        const transformed = transformLineups(data?.lineups, data);
        return res.status(200).json({ response: transformed });
    } catch (err) {
        console.error('❌ [Lineups API] Error:', err.message);
        return res.status(500).json({
            error: 'API_INIT_FAILED',
            message: err.message || 'Environment variables missing on server.',
        });
    }
}
