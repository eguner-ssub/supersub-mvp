import 'dotenv/config';

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://api.sportmonks.com/v3/football';
const CORE_URL = 'https://api.sportmonks.com/v3/core';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Sportmonks league IDs for in-scope leagues
const LEAGUE_IDS = [8, 9, 82, 564, 384]; // EPL, Championship, Bundesliga, La Liga, Serie A

function getToken() {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) throw new Error('Missing env var SPORTMONKS_API_TOKEN');
  return token;
}

// ── Request wrapper with retry + backoff ────────────────────────────────────

async function request(path, params = {}, baseUrl = BASE_URL) {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set('api_token', getToken());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url.toString());
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      throw new Error(`Sportmonks request failed after ${MAX_RETRIES + 1} attempts: ${err.message}`);
    }

    // Hard fail on auth errors — no retry
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Sportmonks auth error ${res.status} on ${path}`);
    }

    // Rate limited — respect Retry-After header, then exponential backoff
    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseFloat(retryAfter) * 1000
          : INITIAL_BACKOFF_MS * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }
      throw new Error(`Sportmonks rate limit exceeded after ${MAX_RETRIES + 1} attempts on ${path}`);
    }

    // Server errors — retry with backoff
    if (res.status >= 500) {
      lastError = new Error(`Sportmonks ${res.status} on ${path}`);
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      throw lastError;
    }

    // Success or client error (4xx other than 401/403/429) — parse and return
    const json = await res.json();

    if (!res.ok) {
      throw new Error(`Sportmonks ${res.status} on ${path}: ${JSON.stringify(json)}`);
    }

    return json;
  }

  throw lastError || new Error(`Sportmonks request failed on ${path}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Helper to build filter strings ──────────────────────────────────────────

function leagueFilter(ids) {
  return `fixtureLeagues:${ids.join(',')}`;
}

// ── Public API methods ──────────────────────────────────────────────────────

/** Fixtures for a single date, optionally filtered by league IDs. */
export function getFixturesByDate(date, leagueIds = LEAGUE_IDS) {
  return request(`/fixtures/date/${date}`, {
    include: 'scores;state;participants',
    filters: leagueFilter(leagueIds),
  });
}

/** Fixtures between two dates for a single league. */
export function getFixturesByDateRange(from, to, leagueId) {
  return request(`/fixtures/between/${from}/${to}`, {
    include: 'scores;state;participants',
    filters: `fixtureLeagues:${leagueId}`,
  });
}

/** Single fixture with full detail. */
export function getFixtureById(id) {
  return request(`/fixtures/${id}`, {
    include: 'scores;state;events;lineups;participants',
  });
}

/** In-play live scores filtered by league. */
export function getLiveScores(leagueIds = LEAGUE_IDS) {
  return request('/livescores/inplay', {
    include: 'scores;state;events',
    filters: `${leagueFilter(leagueIds)};eventTypes:14,18`,
  });
}

/** Pre-live scores (upcoming/about to start) filtered by league. */
export function getPreLiveScores(leagueIds = LEAGUE_IDS) {
  return request('/livescores', {
    include: 'lineups;participants',
    filters: leagueFilter(leagueIds),
  });
}

/** Season standings with participant details. */
export function getStandings(seasonId) {
  return request(`/standings/seasons/${seasonId}`, {
    include: 'participant;details',
  });
}

/** Top scorers for a season. Supports pagination via optional page param. */
export function getTopScorers(seasonId, page) {
  const params = { include: 'player;participant' };
  if (page != null) params.page = page;
  return request(`/topscorers/seasons/${seasonId}`, params);
}

/** Team statistics for a specific season. */
export function getTeamStats(teamId, seasonId) {
  return request(`/teams/${teamId}`, {
    include: 'statistics',
    filters: `teamStatisticSeasons:${seasonId}`,
  });
}

/** Leagues in scope with current season and country. */
export function getLeagues() {
  return request('/leagues', {
    include: 'currentSeason;country',
    filters: `leagueIds:${LEAGUE_IDS.join(',')}`,
  });
}

/**
 * All entity types (for reference cache).
 * Endpoint: GET /v3/core/types
 */
export function getTypes() {
  return request('/types', {}, CORE_URL);
}