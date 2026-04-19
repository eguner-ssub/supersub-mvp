// Dynamic-route dispatcher for /api/stats-gen/*.
//
// Why one file for 15 endpoints? Vercel Hobby caps each deployment at 12
// serverless functions, and every file under api/ counts as one. Collapsing
// the surface into a single [endpoint].js keeps us well under the cap while
// preserving the stable URL shape (`/api/stats-gen/matches`, `/api/stats-gen/fortress`,
// etc). The heavy lifting lives in lib/statsGen/handlers/*.js — anything
// outside api/ is not deployed as a function.
//
// Auth is applied once at the top; each handler also re-checks (defence in
// depth, so importing a handler in isolation from tests still gates cleanly).

import { requireStatsGenToken } from '../../lib/statsGen/auth.js';

// ── Context endpoints ────────────────────────────────────────────────────────
import leagues          from '../../lib/statsGen/handlers/leagues.js';
import matches          from '../../lib/statsGen/handlers/matches.js';
// ── Match-scoped content ─────────────────────────────────────────────────────
import benchWatch       from '../../lib/statsGen/handlers/bench-watch.js';
import lineups          from '../../lib/statsGen/handlers/lineups.js';
import h2h              from '../../lib/statsGen/handlers/h2h.js';
import banker           from '../../lib/statsGen/handlers/banker.js';
import overUnder        from '../../lib/statsGen/handlers/over-under.js';
import formTable        from '../../lib/statsGen/handlers/form-table.js';
import refereeWatch     from '../../lib/statsGen/handlers/referee-watch.js';
import wastedBench      from '../../lib/statsGen/handlers/wasted-bench.js';
// ── League-scoped content ────────────────────────────────────────────────────
import impactWindow     from '../../lib/statsGen/handlers/impact-window.js';
import goalsPerGround   from '../../lib/statsGen/handlers/goals-per-ground.js';
import goalGlut         from '../../lib/statsGen/handlers/goal-glut.js';
import firstBlood       from '../../lib/statsGen/handlers/first-blood.js';
import fortress         from '../../lib/statsGen/handlers/fortress.js';
// ── Wrapper / composite endpoints ────────────────────────────────────────────
import analytics        from '../../lib/statsGen/handlers/analytics.js';
import playerSpotlight  from '../../lib/statsGen/handlers/player-spotlight.js';
import benchContribution from '../../lib/statsGen/handlers/bench-contribution.js';
import supersubStats    from '../../lib/statsGen/handlers/supersub-stats.js';
import benchVsStarter   from '../../lib/statsGen/handlers/bench-vs-starter.js';
import gwBenchToWatch   from '../../lib/statsGen/handlers/gw-bench-to-watch.js';
import comebackBench    from '../../lib/statsGen/handlers/comeback-bench.js';
import supersubOfWeek   from '../../lib/statsGen/handlers/supersub-of-week.js';
import fplWatch         from '../../lib/statsGen/handlers/fpl-watch.js';
// ── Intel-sourced endpoints (wrap /api/intel) ────────────────────────────────
import intelFormGuide      from '../../lib/statsGen/handlers/intelFormGuide.js';
import intelKeyMatchup     from '../../lib/statsGen/handlers/intelKeyMatchup.js';
import intelGoalsMarket    from '../../lib/statsGen/handlers/intelGoalsMarket.js';
import intelPrediction     from '../../lib/statsGen/handlers/intelPrediction.js';
import intelSupersubWatch  from '../../lib/statsGen/handlers/intelSupersubWatch.js';

// Map slug → handler (24 total + 2 context = 26 endpoints, 1 Vercel function).
const HANDLERS = {
  // Context
  'leagues':             leagues,
  'matches':             matches,
  // Match-scoped
  'bench-watch':         benchWatch,
  'lineups':             lineups,
  'h2h':                 h2h,
  'banker':              banker,
  'over-under':          overUnder,
  'form-table':          formTable,
  'referee-watch':       refereeWatch,
  'wasted-bench':        wastedBench,
  // League-scoped
  'impact-window':       impactWindow,
  'goals-per-ground':    goalsPerGround,
  'goal-glut':           goalGlut,
  'first-blood':         firstBlood,
  'fortress':            fortress,
  // Wrapper / composite
  'analytics':           analytics,
  'player-spotlight':    playerSpotlight,
  'bench-contribution':  benchContribution,
  'supersub-stats':      supersubStats,
  'bench-vs-starter':    benchVsStarter,
  'gw-bench-to-watch':   gwBenchToWatch,
  'comeback-bench':      comebackBench,
  'supersub-of-week':    supersubOfWeek,
  'fpl-watch':           fplWatch,
  // Intel-sourced (wrap /api/intel)
  'intel-form-guide':      intelFormGuide,
  'intel-key-matchup':     intelKeyMatchup,
  'intel-goals-market':    intelGoalsMarket,
  'intel-prediction':      intelPrediction,
  'intel-supersub-watch':  intelSupersubWatch,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireStatsGenToken(req, res)) return;

  // Vercel fills req.query.endpoint from the [endpoint] path segment.
  // We stay defensive in case this ever gets called via a different runtime.
  const endpoint = req.query?.endpoint;
  const fn = typeof endpoint === 'string' ? HANDLERS[endpoint] : null;
  if (!fn) {
    return res.status(404).json({
      error: 'Unknown stats-gen endpoint',
      endpoint: endpoint ?? null,
      known: Object.keys(HANDLERS),
    });
  }

  return fn(req, res);
}
