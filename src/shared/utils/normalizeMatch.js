/**
 * normalizeMatch(raw)
 *
 * Bridges the gap between flat Supabase rows and the nested API-Football
 * JSON shape that all components (MatchDetail, ManagerOffice, oddsService,
 * GameContext.placeBet) expect.
 *
 * Detection: if `raw.fixture` already exists the data is nested → pass-through.
 * Otherwise map flat columns into the canonical nested shape.
 */
export function normalizeMatch(raw) {
    if (!raw) return null;

    // Already in nested API-Football format — pass through unchanged
    if (raw.fixture) return raw;

    // ── Flat Supabase row → nested shape ──────────────────────────────────
    return {
        // Preserve every original flat field so nothing is lost downstream
        ...raw,

        fixture: {
            id: raw.id,
            date: raw.kickoff_time || raw.date || null,
            status: {
                short: raw.status || 'NS',
                elapsed: raw.elapsed ?? null,
            },
        },

        teams: {
            home: {
                id: raw.home_team_id ?? null,
                name: raw.home_team || 'Home',
                logo: raw.home_logo || null,
            },
            away: {
                id: raw.away_team_id ?? null,
                name: raw.away_team || 'Away',
                logo: raw.away_logo || null,
            },
        },

        goals: {
            home: raw.home_score ?? 0,
            away: raw.away_score ?? 0,
        },

        league: {
            id: raw.league_id ?? null,
            name: raw.league_name || '',
            logo: raw.league_logo || null,
        },
    };
}
