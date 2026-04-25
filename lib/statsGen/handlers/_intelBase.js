// Shared plumbing for /api/stats-gen/intel-* handlers.
//
// All 5 intel content types (form-guide, key-matchup, goals-market,
// prediction, supersub-watch) consume the same /api/intel response — we
// invoke the intel handler in-process (no HTTP hop) with a mock res to
// capture the JSON body, then enrich with homeLogo/awayLogo/leagueName
// (which the intel endpoint doesn't include) from the matches table.
//
// Each type-specific handler delegates to `runIntelHandler` passing a
// `buildContent(analysis, intelBody) → { content, dataStatus }` function
// that extracts the relevant section and flags unavailable state.

import { requireStatsGenToken, getSupabase } from '../auth.js';
import intelHandler from '../../../api/intel.js';

// Placeholder strings used by api/intel.js:toFrontendFormat when a section
// can't be rendered. Matching against these lets us flag dataStatus=unavailable.
const UNAVAILABLE_PLACEHOLDERS = new Set([
  'Form data unavailable for this match.',
  'Match prediction data unavailable.',
  'Goals market data unavailable.',
  'Prediction unavailable.',
]);

export function isPlaceholderProse(s) {
  return typeof s === 'string' && UNAVAILABLE_PLACEHOLDERS.has(s.trim());
}

/**
 * Invoke api/intel.js in-process with a mock res.
 * Returns { status, body } — same shape as a real HTTP call.
 */
function fetchIntel(matchId) {
  return new Promise((resolve) => {
    let status = 200;
    const mockRes = {
      status(c) { status = c; return this; },
      json(body) { resolve({ status, body }); return this; },
    };
    // Pre-match phase (default) — intel handler reads match_id from query
    intelHandler(
      { method: 'GET', query: { match_id: String(matchId) }, headers: {} },
      mockRes,
    ).catch((err) => resolve({ status: 500, body: { error: err?.message || 'intel error' } }));
  });
}

/**
 * Look up homeLogo/awayLogo/leagueName for a fixture. Intel's `match`
 * block only has id/home/away/kickoff, so we enrich here.
 */
async function fetchMatchExtras(supabase, matchId) {
  const { data } = await supabase
    .from('matches')
    .select('home_logo, away_logo, league_id, league_name')
    .eq('id', matchId)
    .maybeSingle();
  return data || {};
}

/**
 * Shared handler body. Returns the standard envelope or an error response.
 * `buildContent({ analysis, intelBody, matchExtras })` must return
 * `{ content, dataStatus }`.
 */
export async function runIntelHandler(req, res, { type, buildContent }) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  // Standardised on `fixture_id` to match the rest of the stats-gen surface
  // (banker, h2h, lineups, match-probabilities, etc.). `match_id` is accepted
  // for one release as a deprecation shim — remove once FE call sites are
  // confirmed migrated.
  let matchId = parseInt(req.query.fixture_id, 10);
  if (!matchId && req.query.match_id) {
    console.warn(`[stats-gen/${type}] match_id is deprecated; use fixture_id`);
    matchId = parseInt(req.query.match_id, 10);
  }
  if (!matchId) return res.status(400).json({ error: 'fixture_id required' });

  try {
    const supabase = getSupabase();
    const [{ status: intelStatus, body: intelBody }, extras] = await Promise.all([
      fetchIntel(matchId),
      fetchMatchExtras(supabase, matchId),
    ]);

    if (intelStatus === 404) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    if (intelStatus >= 400 || !intelBody) {
      return res.status(500).json({ error: intelBody?.error || 'Intel fetch failed' });
    }

    // Intel returned available:false (lineups_phase window — <60m before KO).
    // Surface as an unavailable payload so the preview can render cleanly.
    if (intelBody.available === false) {
      return res.status(200).json({
        type,
        match: buildMatchBlock(intelBody.match, extras),
        content: null,
        dataStatus: 'unavailable',
        reason: intelBody.reason || 'intel_window_closed',
        generatedAt: new Date().toISOString(),
      });
    }

    const analysis = intelBody.analysis || {};
    const { content, dataStatus } = buildContent({ analysis, intelBody, matchExtras: extras });

    return res.status(200).json({
      type,
      match: buildMatchBlock(intelBody.match, extras),
      content,
      dataStatus,
      generatedAt: intelBody.generatedAt || new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[stats-gen/${type}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

function buildMatchBlock(intelMatch, extras) {
  return {
    id: intelMatch?.id,
    homeTeam: intelMatch?.homeTeam,
    awayTeam: intelMatch?.awayTeam,
    homeLogo: extras?.home_logo || null,
    awayLogo: extras?.away_logo || null,
    kickoffTime: intelMatch?.kickoffTime,
    leagueId: extras?.league_id || null,
    leagueName: extras?.league_name || null,
  };
}

/**
 * Look up an analysis.sections[] entry by title.
 * Titles are stable in api/intel.js:toFrontendFormat.
 */
export function getSection(analysis, title) {
  const sections = Array.isArray(analysis?.sections) ? analysis.sections : [];
  return sections.find(s => s?.title === title) || null;
}
