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

import leagues          from '../../lib/statsGen/handlers/leagues.js';
import matches          from '../../lib/statsGen/handlers/matches.js';
import benchWatch       from '../../lib/statsGen/handlers/bench-watch.js';
import lineups          from '../../lib/statsGen/handlers/lineups.js';
import h2h              from '../../lib/statsGen/handlers/h2h.js';
import banker           from '../../lib/statsGen/handlers/banker.js';
import impactWindow     from '../../lib/statsGen/handlers/impact-window.js';
import supersubOfWeek   from '../../lib/statsGen/handlers/supersub-of-week.js';
import wastedBench      from '../../lib/statsGen/handlers/wasted-bench.js';
import refereeWatch     from '../../lib/statsGen/handlers/referee-watch.js';
import goalsPerGround   from '../../lib/statsGen/handlers/goals-per-ground.js';
import goalGlut         from '../../lib/statsGen/handlers/goal-glut.js';
import firstBlood       from '../../lib/statsGen/handlers/first-blood.js';
import overUnder        from '../../lib/statsGen/handlers/over-under.js';
import formTable        from '../../lib/statsGen/handlers/form-table.js';
import fortress         from '../../lib/statsGen/handlers/fortress.js';

// Map slug → handler. Slugs match what the frontend hits today.
const HANDLERS = {
  'leagues':           leagues,
  'matches':           matches,
  'bench-watch':       benchWatch,
  'lineups':           lineups,
  'h2h':               h2h,
  'banker':            banker,
  'impact-window':     impactWindow,
  'supersub-of-week':  supersubOfWeek,
  'wasted-bench':      wastedBench,
  'referee-watch':     refereeWatch,
  'goals-per-ground':  goalsPerGround,
  'goal-glut':         goalGlut,
  'first-blood':       firstBlood,
  'over-under':        overUnder,
  'form-table':        formTable,
  'fortress':          fortress,
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
