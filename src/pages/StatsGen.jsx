import React, { useState, useEffect, useCallback } from 'react';
// Match-scoped previews
import { BenchWatchPreview } from './stats-gen/previews/BenchWatchPreview';
import { LineupsPreview } from './stats-gen/previews/LineupsPreview';
import { H2HPreview } from './stats-gen/previews/H2HPreview';
import { BankerPreview } from './stats-gen/previews/BankerPreview';
import { OverUnderPreview } from './stats-gen/previews/OverUnderPreview';
import { FormTablePreview } from './stats-gen/previews/FormTablePreview';
import { RefereeWatchPreview } from './stats-gen/previews/RefereeWatchPreview';
import { WastedBenchPreview } from './stats-gen/previews/WastedBenchPreview';
// League-scoped previews
import { AnalyticsPreview } from './stats-gen/previews/AnalyticsPreview';
import { PlayerSpotlightPreview } from './stats-gen/previews/PlayerSpotlightPreview';
import { BenchContributionPreview } from './stats-gen/previews/BenchContributionPreview';
import { SupersubStatsPreview } from './stats-gen/previews/SupersubStatsPreview';
import { ImpactWindowPreview } from './stats-gen/previews/ImpactWindowPreview';
import { GoalsPerGroundPreview } from './stats-gen/previews/GoalsPerGroundPreview';
import { GoalGlutPreview } from './stats-gen/previews/GoalGlutPreview';
import { FirstBloodPreview } from './stats-gen/previews/FirstBloodPreview';
import { FortressPreview } from './stats-gen/previews/FortressPreview';
// Wrapper previews
import { BenchVsStarterPreview } from './stats-gen/previews/BenchVsStarterPreview';
import { GWBenchToWatchPreview } from './stats-gen/previews/GWBenchToWatchPreview';
import { ComebackBenchPreview } from './stats-gen/previews/ComebackBenchPreview';
import { SupersubOfWeekPreview } from './stats-gen/previews/SupersubOfWeekPreview';
import { FPLWatchPreview } from './stats-gen/previews/FPLWatchPreview';

const STORAGE_KEY = 'stats_gen_password';

// ─── Consistent league ordering (matches coverage.js config) ─────────────────
const LEAGUE_ORDER = [8, 301, 82, 564, 384];

// ─── Preview router (all 22 content types) ───────────────────────────────────
const PREVIEW_MAP = {
  'bench-watch': BenchWatchPreview, 'lineups': LineupsPreview, 'h2h': H2HPreview,
  'banker': BankerPreview, 'over-under': OverUnderPreview, 'form-table': FormTablePreview,
  'referee-watch': RefereeWatchPreview, 'wasted-bench': WastedBenchPreview,
  'analytics': AnalyticsPreview, 'player-spotlight': PlayerSpotlightPreview,
  'bench-contribution': BenchContributionPreview, 'supersub-stats': SupersubStatsPreview,
  'impact-window': ImpactWindowPreview, 'goals-per-ground': GoalsPerGroundPreview,
  'goal-glut': GoalGlutPreview, 'first-blood': FirstBloodPreview, 'fortress': FortressPreview,
  'bench-vs-starter': BenchVsStarterPreview, 'gw-bench-to-watch': GWBenchToWatchPreview,
  'comeback-bench': ComebackBenchPreview, 'supersub-of-week': SupersubOfWeekPreview,
  'fpl-watch': FPLWatchPreview,
};

function renderPreview(contentType, data) {
  if (!data) return null;
  const Preview = PREVIEW_MAP[contentType];
  if (Preview) return <Preview data={data} />;
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
      <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-4">{contentType}</p>
      <pre className="text-zinc-300 text-xs font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ─── Content type definitions ────────────────────────────────────────────────
const CONTENT_TYPES = {
  'supersub-focused': {
    label: 'Supersub Focused',
    types: [
      { id: 'bench-watch', label: 'Bench Watch', selectors: ['match'] },
      { id: 'analytics', label: 'Analytics (League)', selectors: ['league'] },
      { id: 'lineups', label: 'Lineups', selectors: ['match'] },
      { id: 'player-spotlight', label: 'Player Spotlight', selectors: ['league'] },
      { id: 'bench-contribution', label: 'Bench Contribution', selectors: ['league'] },
      { id: 'fpl-watch', label: 'FPL Watch', selectors: ['gameweek'] },
      { id: 'supersub-stats', label: 'Supersub Stats', selectors: ['league', 'team-optional'] },
      { id: 'impact-window', label: 'Impact Window', selectors: ['league'] },
      { id: 'comeback-bench', label: 'Comeback Bench', selectors: ['match-or-league-gw'] },
      { id: 'supersub-of-week', label: 'Supersub of the Week', selectors: ['league', 'gameweek'] },
      { id: 'bench-vs-starter', label: 'Bench vs Starter', selectors: ['league'] },
      { id: 'gw-bench-to-watch', label: 'GW Bench to Watch', selectors: ['league', 'gameweek'] },
      { id: 'wasted-bench', label: 'Wasted Bench', selectors: ['match', 'team'] },
    ],
  },
  'match-result': {
    label: 'Match Result & Goals',
    types: [
      { id: 'form-table', label: 'Form Table Flip', selectors: ['match'] },
      { id: 'fortress', label: 'The Fortress', selectors: ['league'] },
      { id: 'h2h', label: 'Head to Head', selectors: ['match'] },
      { id: 'banker', label: 'The Banker', selectors: ['match'] },
      { id: 'goals-per-ground', label: 'Goals Per Ground', selectors: ['league'] },
      { id: 'over-under', label: 'Over/Under Split', selectors: ['match'] },
      { id: 'referee-watch', label: 'Referee Watch', selectors: ['match'] },
      { id: 'goal-glut', label: 'Goal Glut', selectors: ['league', 'gameweek-optional'] },
      { id: 'first-blood', label: 'First Blood', selectors: ['league'] },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findContentType(typeId) {
  for (const group of Object.values(CONTENT_TYPES)) {
    const found = group.types.find((t) => t.id === typeId);
    if (found) return found;
  }
  return null;
}

function hasSel(type, ...checks) {
  if (!type) return false;
  return checks.some((c) => (type.selectors || []).includes(c));
}

const needsMatch = (t) => hasSel(t, 'match', 'match-or-league-gw');
const needsLeague = (t) => hasSel(t, 'league', 'match-or-league-gw', 'team-optional');
const needsGameweek = (t) => hasSel(t, 'gameweek', 'gameweek-optional', 'match-or-league-gw');
const isGameweekOptional = (t) => hasSel(t, 'gameweek-optional');
const needsTeam = (t) => hasSel(t, 'team', 'team-optional');
const isTeamOptional = (t) => hasSel(t, 'team-optional');

function groupedByLeague(matches) {
  // Group + sort by LEAGUE_ORDER, then by kickoff_time within each league
  const map = new Map();
  for (const m of matches) {
    const key = m.league_id;
    if (!map.has(key)) map.set(key, { name: m.league_name || `League ${key}`, matches: [] });
    map.get(key).matches.push(m);
  }
  // Sort matches within each league by kickoff_time ascending
  for (const group of map.values()) {
    group.matches.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
  }
  // Return groups in LEAGUE_ORDER, then any extras
  const ordered = [];
  for (const lid of LEAGUE_ORDER) {
    const g = map.get(lid);
    if (g) ordered.push([g.name, g.matches]);
  }
  for (const [lid, g] of map) {
    if (!LEAGUE_ORDER.includes(lid)) ordered.push([g.name, g.matches]);
  }
  return ordered;
}

function buildEndpointUrl(type, { selectedMatch, selectedLeague, selectedGameweek, selectedTeam }) {
  const params = new URLSearchParams();
  const sels = type?.selectors || [];

  if (sels.includes('match') && selectedMatch) params.set('fixture_id', selectedMatch.id);
  if ((sels.includes('league') || sels.includes('team-optional')) && selectedLeague) params.set('league_id', selectedLeague.id);

  if (sels.includes('match-or-league-gw')) {
    if (selectedMatch) params.set('fixture_id', selectedMatch.id);
    else if (selectedLeague) {
      params.set('league_id', selectedLeague.id);
      if (selectedGameweek) params.set('gameweek', selectedGameweek);
    }
  }

  if ((sels.includes('gameweek') || sels.includes('gameweek-optional')) && selectedGameweek) {
    params.set('gameweek', selectedGameweek);
  }

  if ((sels.includes('team') || sels.includes('team-optional')) && selectedTeam && selectedMatch) {
    const teamId = selectedTeam === 'home' ? selectedMatch.home_team_id : selectedMatch.away_team_id;
    if (teamId) params.set('team_id', teamId);
  }

  return `/api/stats-gen/${type.id}?${params.toString()}`;
}

function hasRequiredSelectors(type, state) {
  if (!type) return false;
  for (const sel of type.selectors || []) {
    switch (sel) {
      case 'match': if (!state.selectedMatch) return false; break;
      case 'league': if (!state.selectedLeague) return false; break;
      case 'gameweek': if (!state.selectedGameweek) return false; break;
      case 'team': if (!state.selectedTeam) return false; break;
      case 'match-or-league-gw': if (!state.selectedMatch && !state.selectedLeague) return false; break;
    }
  }
  return true;
}

// ─── Shared Tailwind classes ─────────────────────────────────────────────────
const LABEL_CLS = 'text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2 block';
const SELECT_CLS = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500';
const INPUT_CLS = 'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500';

// ─── Loading skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-zinc-900">
        <div>
          <div className="h-3 w-24 bg-zinc-800 rounded mb-2" />
          <div className="h-4 w-48 bg-zinc-800 rounded" />
        </div>
        <div className="h-5 w-20 bg-zinc-800 rounded" />
      </div>
      <div className="space-y-4">
        <div className="h-8 bg-zinc-900 rounded-lg" />
        <div className="flex gap-4">
          <div className="h-20 flex-1 bg-zinc-900 rounded-lg" />
          <div className="h-20 flex-1 bg-zinc-900 rounded-lg" />
          <div className="h-20 flex-1 bg-zinc-900 rounded-lg" />
        </div>
        <div className="h-32 bg-zinc-900 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Error card ──────────────────────────────────────────────────────────────
function ErrorCard({ error, onRetry }) {
  return (
    <div className="bg-zinc-950 border border-red-500/30 rounded-xl p-6">
      <div className="text-center py-6">
        <p className="text-red-400 text-sm font-bold mb-2">Failed to load data</p>
        <p className="text-zinc-500 text-xs mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold uppercase tracking-widest text-[10px] rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ─── Controls Panel ──────────────────────────────────────────────────────────

function ControlsPanel({
  matches, leagues, contentType, setContentType,
  selectedMatch, setSelectedMatch, selectedLeague, setSelectedLeague,
  selectedGameweek, setSelectedGameweek, selectedTeam, setSelectedTeam,
  loading, previewData, onLoadData, onCopyJson, onLogout,
}) {
  const typeConfig = findContentType(contentType);

  const handleTypeChange = (e) => {
    setContentType(e.target.value || null);
    setSelectedMatch(null);
    setSelectedLeague(null);
    setSelectedGameweek(null);
    setSelectedTeam(null);
  };

  const ready = hasRequiredSelectors(typeConfig, {
    selectedMatch, selectedLeague, selectedGameweek, selectedTeam,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">
          Stats Gen
        </p>

        {/* Content type dropdown */}
        <section className="mb-5">
          <label className={LABEL_CLS}>Content Type</label>
          <select value={contentType || ''} onChange={handleTypeChange} className={SELECT_CLS}>
            <option value="">Select type…</option>
            {Object.entries(CONTENT_TYPES).map(([groupKey, group]) => (
              <optgroup key={groupKey} label={group.label}>
                {group.types.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </section>

        {/* Conditional selectors */}
        {needsMatch(typeConfig) && (
          <section className="mb-5">
            <label className={LABEL_CLS}>Match</label>
            <select
              value={selectedMatch?.id || ''}
              onChange={(e) => setSelectedMatch(matches.find((m) => m.id === parseInt(e.target.value)) || null)}
              className={SELECT_CLS}
            >
              <option value="">Select match…</option>
              {groupedByLeague(matches).map(([leagueName, leagueMatches]) => (
                <optgroup key={leagueName} label={leagueName}>
                  {leagueMatches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.home_team} vs {m.away_team}
                      {m.round_name ? ` — ${m.round_name}` : ''}
                      {m.date ? ` — ${m.date}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </section>
        )}

        {needsLeague(typeConfig) && (
          <section className="mb-5">
            <label className={LABEL_CLS}>League</label>
            <select
              value={selectedLeague?.id || ''}
              onChange={(e) => setSelectedLeague(leagues.find((l) => l.id === parseInt(e.target.value)) || null)}
              className={SELECT_CLS}
            >
              <option value="">Select league…</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </section>
        )}

        {needsGameweek(typeConfig) && (
          <section className="mb-5">
            <label className={LABEL_CLS}>
              Gameweek{isGameweekOptional(typeConfig) ? ' (optional)' : ''}
            </label>
            <input
              type="number" min={1} max={38}
              value={selectedGameweek || ''}
              onChange={(e) => setSelectedGameweek(e.target.value || null)}
              placeholder="e.g. 28"
              className={INPUT_CLS}
            />
          </section>
        )}

        {needsTeam(typeConfig) && selectedMatch && (
          <section className="mb-5">
            <label className={LABEL_CLS}>
              Team{isTeamOptional(typeConfig) ? ' (optional)' : ''}
            </label>
            <div className="flex gap-2">
              {['home', 'away'].map((side) => (
                <button
                  key={side}
                  onClick={() => setSelectedTeam(side)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    selectedTeam === side
                      ? 'bg-cyan-500 text-black'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {side === 'home' ? selectedMatch.home_team : selectedMatch.away_team}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Action buttons */}
        <section className="mt-6 space-y-3">
          <button
            onClick={onLoadData}
            disabled={!contentType || loading || !ready}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black uppercase tracking-widest text-xs rounded-lg transition-colors"
          >
            {loading ? 'Loading…' : 'Load Data'}
          </button>

          {previewData && (
            <button
              onClick={onCopyJson}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-widest text-[10px] rounded-lg transition-colors"
            >
              Copy JSON
            </button>
          )}
        </section>
      </div>

      {/* Logout — pinned to sidebar bottom */}
      <div className="pt-4 mt-4 border-t border-zinc-900 flex-shrink-0">
        <button
          onClick={onLogout}
          className="text-zinc-600 hover:text-zinc-400 text-[10px] font-medium transition-colors"
        >
          Clear password
        </button>
      </div>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function StatsGen() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(STORAGE_KEY) || null);
  const [authError, setAuthError] = useState(null);
  const [viewportOk, setViewportOk] = useState(window.innerWidth >= 768);

  const [contentType, setContentType] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedGameweek, setSelectedGameweek] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [leagues, setLeagues] = useState([]);

  // Viewport resize
  useEffect(() => {
    const handleResize = () => setViewportOk(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch matches + leagues on auth (with 401 fallback)
  useEffect(() => {
    const pw = sessionStorage.getItem(STORAGE_KEY);
    if (!pw) return;

    Promise.all([
      fetch('/api/stats-gen/matches', { headers: { 'x-stats-gen-password': pw } }),
      fetch('/api/stats-gen/leagues', { headers: { 'x-stats-gen-password': pw } }),
    ]).then(async ([mRes, lRes]) => {
      // If stored password is stale (env var rotated), clear and show gate
      if (mRes.status === 401 || lRes.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        setPassword(null);
        return;
      }
      const [m, l] = await Promise.all([mRes.json(), lRes.json()]);
      setMatches(m.matches || []);
      setLeagues(l.leagues || []);
    }).catch(() => {
      // Network error on initial load — clear password to allow retry
      sessionStorage.removeItem(STORAGE_KEY);
      setPassword(null);
    });
  }, [password]);

  // Keyboard shortcut: Cmd/Ctrl+Enter → Load Data
  const handleLoadData = useCallback(async () => {
    const typeConfig = findContentType(contentType);
    if (!typeConfig) return;
    if (!hasRequiredSelectors(typeConfig, { selectedMatch, selectedLeague, selectedGameweek, selectedTeam })) return;

    setLoading(true);
    setPreviewError(null);
    setPreviewData(null);

    const pw = sessionStorage.getItem(STORAGE_KEY);
    const url = buildEndpointUrl(typeConfig, { selectedMatch, selectedLeague, selectedGameweek, selectedTeam });

    try {
      const res = await fetch(url, { headers: { 'x-stats-gen-password': pw } });
      const data = await res.json();

      if (!res.ok) {
        setPreviewError(data.error || 'Failed to load');
      } else {
        setPreviewData({ ...data, _contentType: contentType, _fetchedAt: new Date().toISOString() });
      }
    } catch {
      setPreviewError('Network error');
    } finally {
      setLoading(false);
    }
  }, [contentType, selectedMatch, selectedLeague, selectedGameweek, selectedTeam]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleLoadData();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLoadData]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const input = e.target.elements.password.value;
    setAuthError(null);

    try {
      const res = await fetch('/api/stats-gen/matches', {
        headers: { 'x-stats-gen-password': input },
      });
      if (res.ok) {
        sessionStorage.setItem(STORAGE_KEY, input);
        setPassword(input);
      } else if (res.status === 401) {
        setAuthError('Wrong password');
      } else {
        setAuthError('Unexpected error');
      }
    } catch {
      setAuthError('Network error');
    }
  };

  const handleCopyJson = () => {
    if (previewData) navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword(null);
    setPreviewData(null);
    setPreviewError(null);
    setContentType(null);
    setMatches([]);
    setLeagues([]);
  };

  // Mobile placeholder
  if (!viewportOk) {
    return (
      <div className="h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-2">Desktop Only</p>
          <p className="text-zinc-600 text-xs">Stats-gen is not available on mobile or narrow viewports.</p>
        </div>
      </div>
    );
  }

  // Password gate
  if (!password) {
    return (
      <div className="h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-8">
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs">
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-4 text-center">
            Stats Gen · Password Required
          </p>
          <input
            type="password" name="password" autoFocus
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500"
            placeholder="Password"
          />
          <button
            type="submit"
            className="w-full mt-3 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest text-xs rounded-lg transition-colors"
          >
            Enter
          </button>
          {authError && <p className="text-red-400 text-xs text-center mt-3">{authError}</p>}
        </form>
      </div>
    );
  }

  // Preview panel content
  let previewContent;
  if (loading) {
    previewContent = <LoadingSkeleton />;
  } else if (previewError) {
    previewContent = <ErrorCard error={previewError} onRetry={handleLoadData} />;
  } else if (previewData) {
    previewContent = renderPreview(previewData._contentType, previewData);
  } else if (contentType) {
    previewContent = (
      <div className="h-[80vh] flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Set your selectors and click Load Data.</p>
      </div>
    );
  } else {
    previewContent = (
      <div className="h-[80vh] flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Select a content type and load data to preview.</p>
      </div>
    );
  }

  // Main layout — two columns
  return (
    <div className="h-screen w-full bg-[#0a0a0f] flex overflow-hidden">
      {/* Left sidebar — scrolls independently */}
      <aside className="w-[320px] flex-shrink-0 border-r border-zinc-900 p-6 flex flex-col h-full">
        <ControlsPanel
          matches={matches} leagues={leagues}
          contentType={contentType} setContentType={setContentType}
          selectedMatch={selectedMatch} setSelectedMatch={setSelectedMatch}
          selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague}
          selectedGameweek={selectedGameweek} setSelectedGameweek={setSelectedGameweek}
          selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam}
          loading={loading} previewData={previewData}
          onLoadData={handleLoadData} onCopyJson={handleCopyJson} onLogout={handleLogout}
        />
      </aside>

      {/* Right preview panel — scrolls independently */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[960px] mx-auto p-6">
          {previewContent}
        </div>
      </main>
    </div>
  );
}
