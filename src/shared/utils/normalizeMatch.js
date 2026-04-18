import { getLeagueById } from '../config/coverage';

/**
 * normalizeMatch(raw)
 *
 * Bridges the gap between flat Supabase rows and the nested fixture
 * JSON shape that all components (MatchDetail, ManagerOffice, oddsService,
 * GameContext.placeBet) expect.
 *
 * Detection: if `raw.fixture` already exists the data is nested → pass-through.
 * Otherwise map flat columns into the canonical nested shape.
 */
export function normalizeMatch(raw) {
    if (!raw) return null;

    // Already in nested fixture format — patch league if missing then pass through
    if (raw.fixture) {
        if (!raw.league?.name) {
            const leagueInfo = getLeagueById(raw.league_id);
            return {
                ...raw,
                league: {
                    id: raw.league_id,
                    name: raw.league_name || leagueInfo?.name || '',
                    logo: raw.league?.logo || null,
                },
            };
        }
        return raw;
    }

    // ── Flat Supabase row → nested shape ──────────────────────────────────
    return {
        // Preserve every original flat field so nothing is lost downstream
        ...raw,

        fixture: {
            id: raw.id,
            date: raw.kickoff_time || raw.date || null,
            status: {
                short: raw.status || 'NS',
                elapsed: raw.match_minute ?? raw.elapsed ?? null,
            },
        },

        teams: {
            home: {
                id: raw.home_team_id ?? null,
                name: raw.home_team || 'Home',
                logo: raw.home_logo || null,
                short_code: raw.home_team_short_code ?? null,
            },
            away: {
                id: raw.away_team_id ?? null,
                name: raw.away_team || 'Away',
                logo: raw.away_logo || null,
                short_code: raw.away_team_short_code ?? null,
            },
        },

        goals: {
            home: raw.home_score ?? 0,
            away: raw.away_score ?? 0,
        },

        league: {
            id: raw.league_id ?? null,
            name: raw.league_name || getLeagueById(raw.league_id)?.name || '',
            logo: raw.league_logo || null,
        },
    };
}
