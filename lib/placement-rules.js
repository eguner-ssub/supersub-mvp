/**
 * placement-rules.js
 *
 * Server-side validation for card placement and odds fetching.
 */
import { createClient } from '@supabase/supabase-js';
import { request } from './sportmonks.js';

// ── Lazy Supabase Client ────────────────────────────────────────────────────
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

// ── Status classifications (Sportmonks developer_name values) ───────────────
// These match the values stored in matches.status, sourced from
// fixture.state.developer_name in the Sportmonks v3 API.

const FINISHED_STATUSES = [
    'FT', 'AET', 'FT_PEN',
    'POSTPONED', 'CANCELLED', 'ABANDONED',
    'AWARDED', 'WO', 'DELETED',
];

const IN_PLAY_STATUSES = [
    'INPLAY_1ST_HALF',
    'INPLAY_2ND_HALF',
    'INPLAY_ET',
    'INPLAY_ET_SECOND_HALF',
    'INPLAY_PENALTIES',
    'HT',
    'BREAK',
    'EXTRA_TIME_BREAK',
];

const isFinished = (status) => FINISHED_STATUSES.includes(status);

/**
 * Returns true if the match is currently in play.
 * Uses Sportmonks developer_name states.
 *
 * @param {string} matchStatus — Sportmonks developer_name (e.g. 'INPLAY_1ST_HALF', 'HT')
 * @returns {boolean}
 */
export const isMatchInPlay = (status) => IN_PLAY_STATUSES.includes(status);

// ── Main validation function ────────────────────────────────────────────────

/**
 * Validate whether a Supersub card can be placed on a given match/team/player.
 *
 * @param {number} matchId  — matches.id (integer fixture ID)
 * @param {number} teamId   — SportMonks integer team ID (from lineups[].team.id)
 * @param {number|null} playerId — SportMonks player ID (optional, for player-level bets)
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
export async function validateSupersubPlacement(matchId, teamId, playerId = null) {
    // ── 1. Fetch match data ─────────────────────────────────────────────────
    const supabase = getSupabaseClient();

    const { data: match, error } = await supabase
        .from('matches')
        .select('status, events, lineups')
        .eq('id', Number(matchId))
        .single();

    if (error || !match) {
        return { valid: false, reason: 'Match not found' };
    }

    // ── 2. Check match status ───────────────────────────────────────────────
    const { status, events, lineups } = match;

    if (isFinished(status)) {
        return { valid: false, reason: 'Match has already finished' };
    }

    const live = isMatchInPlay(status);

    // ── 3. Validate team exists in lineups ──────────────────────────────────
    const lineupsArray = Array.isArray(lineups) ? lineups : [];
    const teamLineup = lineupsArray.find((l) => l?.team?.id === Number(teamId));

    if (!teamLineup) {
        return { valid: false, reason: 'Team not found in match lineups' };
    }

    // ── 4. In-play: check team has NOT made a substitution ──────────────────
    if (live) {
        const eventsArray = Array.isArray(events) ? events : [];
        const teamSubs = eventsArray.filter(
            (e) => e.type === 'subst' && e.team?.id === Number(teamId)
        );

        if (teamSubs.length > 0) {
            return { valid: false, reason: 'Team has already made a substitution' };
        }
    }

    // ── 5. Player validation (if playerId provided) ─────────────────────────
    if (playerId != null) {
        const pid = Number(playerId);
        const subs = teamLineup.substitutes || [];
        const starters = teamLineup.startXI || [];

        // Player must be in the substitutes list
        const onBench = subs.some((s) => s?.player?.id === pid);
        if (!onBench) {
            // Check if they're a starter (different error message)
            const isStarter = starters.some((s) => s?.player?.id === pid);
            if (isStarter) {
                return { valid: false, reason: 'Player is in the starting eleven, not on the bench' };
            }
            return { valid: false, reason: 'Player not found in team squad' };
        }

        // In-play: check player has NOT already come on as a substitute
        if (live) {
            const eventsArray = Array.isArray(events) ? events : [];
            const alreadyOn = eventsArray.some(
                (e) =>
                    e.type === 'subst' &&
                    e.team?.id === Number(teamId) &&
                    e.assist?.id === pid
            );

            if (alreadyOn) {
                return { valid: false, reason: 'Player has already been substituted onto the pitch' };
            }
        }
    }

    // ── 6. All checks passed ────────────────────────────────────────────────
    return { valid: true, reason: 'Placement allowed' };
}

// ── Player Score validation ─────────────────────────────────────────────────

/**
 * Validate whether a Player Score card can be placed on a given match/player.
 *
 * Rules:
 *   Pre-match only — reject if match is live or finished.
 *   Player must exist in either team's lineup (startXI or substitutes).
 *
 * @param {number} matchId  — matches.id (integer fixture ID)
 * @param {number} playerId — SportMonks player ID
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
export async function validatePlayerScorePlacement(matchId, playerId) {
    const supabase = getSupabaseClient();

    const { data: match, error } = await supabase
        .from('matches')
        .select('status, lineups')
        .eq('id', Number(matchId))
        .single();

    if (error || !match) {
        return { valid: false, reason: 'Match not found' };
    }

    const { status, lineups } = match;

    if (isFinished(status)) {
        return { valid: false, reason: 'Match has already finished' };
    }

    if (isMatchInPlay(status)) {
        return { valid: false, reason: 'Player Score cards can only be placed pre-match' };
    }

    // Validate player exists in any team's lineup
    const pid = Number(playerId);
    const lineupsArray = Array.isArray(lineups) ? lineups : [];

    const playerFound = lineupsArray.some((teamLineup) => {
        const starters = teamLineup.startXI || [];
        const subs = teamLineup.substitutes || [];
        return (
            starters.some((s) => s?.player?.id === pid) ||
            subs.some((s) => s?.player?.id === pid)
        );
    });

    if (!playerFound) {
        return { valid: false, reason: 'Player not found in match lineups' };
    }

    return { valid: true, reason: 'Placement allowed' };
}

// ── Match Result validation ─────────────────────────────────────────────────

/**
 * Validate whether a Match Result card can be placed on a given match.
 * Pre-match only — reject if match is in-play or finished.
 *
 * @param {number} matchId — matches.id
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
export async function validateMatchResultPlacement(matchId) {
    const supabase = getSupabaseClient();

    const { data: match, error } = await supabase
        .from('matches')
        .select('status')
        .eq('id', Number(matchId))
        .single();

    if (error || !match) {
        return { valid: false, reason: 'Match not found' };
    }

    if (isFinished(match.status)) {
        return { valid: false, reason: 'Match has already finished' };
    }

    if (isMatchInPlay(match.status)) {
        return { valid: false, reason: 'Match Result cards can only be placed pre-match' };
    }

    return { valid: true, reason: 'Placement allowed' };
}

// ── Total Goals validation ──────────────────────────────────────────────────

/**
 * Validate whether a Total Goals card can be placed on a given match.
 * Pre-match only — reject if match is in-play or finished.
 *
 * @param {number} matchId — matches.id
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
export async function validateTotalGoalsPlacement(matchId) {
    const supabase = getSupabaseClient();

    const { data: match, error } = await supabase
        .from('matches')
        .select('status')
        .eq('id', Number(matchId))
        .single();

    if (error || !match) {
        return { valid: false, reason: 'Match not found' };
    }

    if (isFinished(match.status)) {
        return { valid: false, reason: 'Match has already finished' };
    }

    if (isMatchInPlay(match.status)) {
        return { valid: false, reason: 'Total Goals cards can only be placed pre-match' };
    }

    return { valid: true, reason: 'Placement allowed' };
}

// ── Odds fetching ───────────────────────────────────────────────────────────

// Sportmonks market IDs
const MARKET_MATCH_RESULT = 1;
const MARKET_OVER_UNDER = 80;
const MARKET_FIRST_GOALSCORER = 8;

/**
 * Fetch real Sportmonks odds for a specific prediction at placement time.
 *
 * @param {number} fixtureId  — Sportmonks fixture ID
 * @param {string} cardType   — e.g. 'c_match_result', 'c_total_goals', 'c_player_score'
 * @param {string} selection  — user's pick (e.g. 'HOME', 'OVER_2_5', 'SCORE_123')
 * @returns {Promise<{ odds: number, snapshot: object }>}
 * @throws {Error} if Sportmonks returns no odds
 */
export async function fetchOddsForPrediction(fixtureId, cardType, selection) {
    const marketId = getMarketId(cardType);

    const json = await request(`/odds/pre-match/fixtures/${fixtureId}`, {
        filters: `markets:${marketId}`,
    });

    const allOdds = json.data || [];
    if (allOdds.length === 0) {
        throw new Error(`No Sportmonks odds available for fixture ${fixtureId}, market ${marketId}`);
    }

    // Pick one bookmaker for consistency (lowest ID)
    const bookmakerIds = [...new Set(allOdds.map(o => o.bookmaker_id))].sort((a, b) => a - b);
    const bookmaker = bookmakerIds[0];
    const filtered = allOdds.filter(o => o.bookmaker_id === bookmaker);

    const type = String(cardType).toLowerCase();

    if (type.includes('match_result') || type.includes('match_winner')) {
        return resolveMatchResultOdds(filtered, selection);
    }

    if (type.includes('total_goals')) {
        return resolveTotalGoalsOdds(filtered, selection);
    }

    if (type.includes('player_score')) {
        return resolvePlayerScoreOdds(filtered, selection);
    }

    throw new Error(`Unsupported card type for odds: ${cardType}`);
}

function getMarketId(cardType) {
    const type = String(cardType).toLowerCase();
    if (type.includes('match_result') || type.includes('match_winner')) return MARKET_MATCH_RESULT;
    if (type.includes('total_goals')) return MARKET_OVER_UNDER;
    if (type.includes('player_score')) return MARKET_FIRST_GOALSCORER;
    throw new Error(`No market mapping for card type: ${cardType}`);
}

function resolveMatchResultOdds(odds, selection) {
    const sel = String(selection).toUpperCase();
    let label;
    if (sel.includes('HOME')) label = 'Home';
    else if (sel.includes('AWAY')) label = 'Away';
    else if (sel.includes('DRAW')) label = 'Draw';
    else throw new Error(`Invalid match result selection: ${selection}`);

    const odd = odds.find(o => o.label === label);
    if (!odd) throw new Error(`No odds found for ${label} in match result market`);

    const snapshot = {};
    for (const o of odds) {
        snapshot[o.label?.toLowerCase()] = parseFloat(o.value);
    }

    return {
        odds: parseFloat(odd.value),
        snapshot: { market: 'match_result', ...snapshot },
    };
}

function resolveTotalGoalsOdds(odds, selection) {
    const sel = String(selection).toUpperCase();
    const isOver = sel.includes('OVER');
    const label = isOver ? 'Over' : 'Under';

    // Find the 2.5 line specifically
    const odd = odds.find(o => o.label === label && String(o.total) === '2.5');
    if (!odd) throw new Error(`No odds found for ${label} 2.5 in total goals market`);

    const over = odds.find(o => o.label === 'Over' && String(o.total) === '2.5');
    const under = odds.find(o => o.label === 'Under' && String(o.total) === '2.5');

    return {
        odds: parseFloat(odd.value),
        snapshot: {
            market: 'total_goals',
            over_2_5: over ? parseFloat(over.value) : 0,
            under_2_5: under ? parseFloat(under.value) : 0,
        },
    };
}

function resolvePlayerScoreOdds(odds, selection) {
    // Selection format: SCORE_<player_id>
    const parts = String(selection).split('_');
    const playerId = parts.length > 1 ? Number(parts[1]) : NaN;

    if (isNaN(playerId)) {
        throw new Error(`Invalid player score selection: ${selection}`);
    }

    // Match by player_id field in Sportmonks odds data
    const odd = odds.find(o => o.player_id === playerId);

    if (!odd) {
        throw new Error(`No Sportmonks odds found for player ${playerId} in goalscorer market`);
    }

    return {
        odds: parseFloat(odd.value),
        snapshot: {
            market: 'first_goalscorer',
            player_id: playerId,
            player_name: odd.name || odd.label || null,
            odds: parseFloat(odd.value),
        },
    };
}
