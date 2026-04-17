import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Trophy, BarChart2, Target, Users, Newspaper, TrendingUp } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/* ─────────────────────────────────────────────
   DESIGN TOKENS
   ───────────────────────────────────────────── */
const C = {
  bg:          '#0a0a0f',
  surface:     'rgba(255,255,255,0.04)',
  border:      'rgba(255,255,255,0.07)',
  white:       '#FFFFFF',
  grey:        '#8892a4',
  greyLight:   '#b0b8c4',
  cyan:        '#00E5FF',
  cyanDim:     'rgba(0,229,255,0.12)',
  cyanGlow:    'rgba(0,229,255,0.25)',
  amber:       '#F5A623',
  emerald:     '#34D399',
  red:         '#F87171',
  glass:       'rgba(0,0,0,0.45)',
};
const FONT = "'Montserrat', sans-serif";

/* ─────────────────────────────────────────────
   LEAGUE CONFIG
   ───────────────────────────────────────────── */
const LEAGUES = [
  { id: 8,   name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', eplOnly: false },
  { id: 9,   name: 'Championship',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', eplOnly: false },
  { id: 82,  name: 'Bundesliga',      flag: '🇩🇪',     eplOnly: false },
  { id: 564, name: 'La Liga',         flag: '🇪🇸',     eplOnly: false },
  { id: 384, name: 'Serie A',         flag: '🇮🇹',     eplOnly: false },
];

const EPL_ID = 8;

const TABS = [
  { key: 'standings', label: 'Table',          icon: Trophy },
  { key: 'fixtures',  label: 'Fixtures',       icon: BarChart2 },
  { key: 'scorers',   label: 'Top Scorers',    icon: Target },
  { key: 'bench',     label: 'Supersub Stats', icon: Users },
  { key: 'news',      label: 'News',           icon: Newspaper,  eplOnly: true },
  { key: 'fpl',       label: 'FPL Market',     icon: TrendingUp, eplOnly: true },
];

/* ─────────────────────────────────────────────
   SKELETON
   ───────────────────────────────────────────── */
const SkeletonRow = ({ cols = 4 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1a24', animation: 'pulse 1.4s ease infinite', flexShrink: 0 }} />
    <div style={{ flex: 1, height: 11, borderRadius: 4, background: '#1a1a24', animation: 'pulse 1.4s ease infinite' }} />
    {Array.from({ length: cols - 1 }).map((_, i) => (
      <div key={i} style={{ width: 28, height: 11, borderRadius: 4, background: '#1a1a24', animation: 'pulse 1.4s ease infinite' }} />
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   FORM DOTS
   ───────────────────────────────────────────── */
const FormDots = ({ form }) => {
  if (!form) return null;
  const results = form.slice(-5).split('');
  const color = { W: C.emerald, D: C.amber, L: C.red };
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {results.map((r, i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: color[r] || C.grey, opacity: 0.85 }} />
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   STANDINGS TAB
   ───────────────────────────────────────────── */
const StandingsTab = ({ leagueId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/league?tab=standings&league_id=${leagueId}`)
      .then(r => r.json())
      .then(d => { setRows(d.standings || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [leagueId]);

  const colStyle = (w, align = 'right') => ({
    fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.greyLight,
    width: w, textAlign: align, flexShrink: 0,
  });

  if (error) return <EmptyState msg={`Could not load standings: ${error}`} />;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Club
        </div>
        <div style={colStyle(22)}>P</div>
        <div style={colStyle(22)}>W</div>
        <div style={colStyle(22)}>D</div>
        <div style={colStyle(22)}>L</div>
        <div className="gd-col" style={colStyle(28)}>GD</div>
        <div style={{ ...colStyle(28), color: C.cyan }}>Pts</div>
      </div>

      {loading
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
        : rows.map((row, i) => (
          <StandingRow key={i} row={row} />
        ))
      }
      {!loading && rows.length === 0 && <EmptyState msg="No standings data available." />}
    </div>
  );
};

const StandingRow = ({ row }) => {
  const posColor = row.position <= 4 ? C.cyan : row.position <= 6 ? C.amber : row.position >= 18 ? C.red : C.grey;
  const gdStr = row.gd > 0 ? `+${row.gd}` : String(row.gd);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <div style={{ width: 20, fontFamily: FONT, fontSize: 11, fontWeight: 700, color: posColor, textAlign: 'center', flexShrink: 0 }}>
        {row.position}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {row.logo
          ? <img src={row.logo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
          : <div style={{ width: 20, height: 20, borderRadius: 4, background: C.surface, flexShrink: 0 }} />
        }
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.team}
        </span>
      </div>
      <Cell w={22} val={row.played} />
      <Cell w={22} val={row.won} />
      <Cell w={22} val={row.drawn} />
      <Cell w={22} val={row.lost} />
      <Cell w={28} val={gdStr} muted className="gd-col" />
      <div style={{ width: 28, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 800, color: C.cyan }}>
        {row.points}
      </div>
    </div>
  );
};

const Cell = ({ w, val, muted = false, className }) => (
  <div className={className} style={{ width: w, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: muted ? C.grey : C.greyLight }}>
    {val ?? '–'}
  </div>
);

/* ─────────────────────────────────────────────
   FIXTURES TAB
   ───────────────────────────────────────────── */
const FINISHED_STATUS = ['FT', 'AET', 'PEN', 'FT_PEN', 'FINISHED', 'AWARDED'];
const LIVE_STATUS = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'HT', 'BREAK', 'EXTRA_TIME_BREAK', 'INPLAY_PENALTIES'];

const FixturesTab = ({ leagueId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/league?tab=fixtures&league_id=${leagueId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setSelectedRound(d.currentRound || d.rounds?.[0] || null);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [leagueId]);

  if (error) return <EmptyState msg={`Could not load fixtures: ${error}`} />;
  if (loading) return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
    </div>
  );
  if (!data?.rounds?.length) return <EmptyState msg="No fixtures available." />;

  const rounds = data.rounds;
  const idx = rounds.indexOf(selectedRound);
  const roundMatches = (data.matches || []).filter(m => m.round === selectedRound);

  const prev = () => idx > 0 && setSelectedRound(rounds[idx - 1]);
  const next = () => idx < rounds.length - 1 && setSelectedRound(rounds[idx + 1]);

  return (
    <div>
      {/* Round navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          onClick={prev}
          disabled={idx <= 0}
          style={{ background: 'none', border: 'none', cursor: idx > 0 ? 'pointer' : 'default', color: idx > 0 ? C.cyan : C.grey, padding: 4, display: 'flex' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: C.white }}>
          {selectedRound}
        </span>
        <button
          onClick={next}
          disabled={idx >= rounds.length - 1}
          style={{ background: 'none', border: 'none', cursor: idx < rounds.length - 1 ? 'pointer' : 'default', color: idx < rounds.length - 1 ? C.cyan : C.grey, padding: 4, display: 'flex' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Matches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {roundMatches.length === 0 && <EmptyState msg="No matches for this round." />}
        {roundMatches.map(m => <FixtureCard key={m.id} match={m} />)}
      </div>
    </div>
  );
};

const FixtureCard = ({ match }) => {
  const navigate = useNavigate();
  const isFinished = FINISHED_STATUS.includes(match.status?.toUpperCase());
  const isLive = LIVE_STATUS.includes(match.status?.toUpperCase());

  const kickoff = match.kickoffTime ? new Date(match.kickoffTime) : null;
  const timeStr = kickoff ? kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–';
  const dateStr = kickoff ? kickoff.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  const scoreOrTime = isFinished
    ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
    : isLive
    ? '● LIVE'
    : timeStr;

  const scoreColor = isLive ? C.emerald : isFinished ? C.greyLight : C.cyan;

  return (
    <div
      onClick={() => navigate(`/match/${match.id}`)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Home team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, justifyContent: 'flex-start' }}>
        {match.homeLogo
          ? <img src={match.homeLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
          : <div style={{ width: 22, height: 22, borderRadius: 4, background: C.glass, flexShrink: 0 }} />
        }
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {match.homeTeam}
        </span>
      </div>

      {/* Score / time */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: scoreColor, whiteSpace: 'nowrap' }}>
          {scoreOrTime}
        </div>
        {!isFinished && !isLive && (
          <div style={{ fontFamily: FONT, fontSize: 9, color: C.grey, marginTop: 1 }}>{dateStr}</div>
        )}
      </div>

      {/* Away team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
          {match.awayTeam}
        </span>
        {match.awayLogo
          ? <img src={match.awayLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
          : <div style={{ width: 22, height: 22, borderRadius: 4, background: C.glass, flexShrink: 0 }} />
        }
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   TOP SCORERS TAB
   ───────────────────────────────────────────── */
const ScorersTab = ({ leagueId }) => {
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/league?tab=scorers&league_id=${leagueId}`)
      .then(r => r.json())
      .then(d => { setScorers(d.scorers || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [leagueId]);

  if (error) return <EmptyState msg={`Could not load scorers: ${error}`} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Player</div>
        <div style={{ width: 40, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Goals</div>
        <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Ast</div>
      </div>

      {loading
        ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
        : scorers.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
            <div style={{ width: 22, fontFamily: FONT, fontSize: 11, fontWeight: 700, color: i < 3 ? C.amber : C.grey, textAlign: 'center', flexShrink: 0 }}>
              {s.rank}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {s.logo
                ? <img src={s.logo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
                : <div style={{ width: 20, height: 20, borderRadius: 4, background: C.surface, flexShrink: 0 }} />
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: C.grey }}>{s.team}</div>
              </div>
            </div>
            <div style={{ width: 40, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 15, fontWeight: 800, color: C.cyan, textShadow: `0 0 8px ${C.cyanGlow}` }}>
              {s.goals}
            </div>
            <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.grey }}>
              {s.assists}
            </div>
          </div>
        ))
      }
      {!loading && scorers.length === 0 && <EmptyState msg="No top scorer data available." />}
    </div>
  );
};

/* ─────────────────────────────────────────────
   BENCH WATCH TAB
   ───────────────────────────────────────────── */
const BenchTab = ({ leagueId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/league?tab=bench&league_id=${leagueId}`)
      .then(r => r.json())
      .then(d => { setRows(d.bench || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [leagueId]);

  const maxGoals = rows[0]?.benchGoals || 1;

  if (error) return <EmptyState msg={`Could not load bench data: ${error}`} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Club</div>
        <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Goals</div>
        <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>P</div>
        <div style={{ width: 42, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.8px' }}>G/M</div>
      </div>

      {loading
        ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
        : rows.map((row, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0 4px', borderBottom: 'none' }}>
              <div style={{ width: 22, fontFamily: FONT, fontSize: 11, fontWeight: 700, color: i < 3 ? C.amber : C.grey, textAlign: 'center', flexShrink: 0 }}>
                {row.rank}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {row.logo
                  ? <img src={row.logo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
                  : <div style={{ width: 20, height: 20, borderRadius: 4, background: C.surface, flexShrink: 0 }} />
                }
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.team}
                </span>
              </div>
              <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 15, fontWeight: 800, color: C.cyan, textShadow: `0 0 8px ${C.cyanGlow}` }}>
                {row.benchGoals}
              </div>
              <div style={{ width: 36, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.greyLight }}>
                {row.matchesPlayed}
              </div>
              <div style={{ width: 42, textAlign: 'right', flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.amber }}>
                {row.benchGoalsPM}
              </div>
            </div>
            {/* Heat bar */}
            <div style={{ paddingLeft: 32, paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  width: `${(row.benchGoals / maxGoals) * 100}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.cyan}, ${C.amber})`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </div>
        ))
      }
      {!loading && rows.length === 0 && <EmptyState msg="No bench data available for this league." />}
    </div>
  );
};

/* ─────────────────────────────────────────────
   NEWS TAB (EPL only)
   ───────────────────────────────────────────── */
const NewsTab = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const LIMIT = 20;

  const fetchNews = useCallback((off) => {
    setLoading(true);
    fetch(`/api/news?league_id=8&limit=${LIMIT}&offset=${off}`)
      .then(r => r.json())
      .then(d => {
        setArticles(prev => off === 0 ? (d.articles || []) : [...prev, ...(d.articles || [])]);
        setTotal(d.total || 0);
        setOffset(off + (d.articles?.length || 0));
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchNews(0); }, [fetchNews]);

  if (error) return <EmptyState msg={`Could not load news: ${error}`} />;

  const sourceColor = { 'BBC': C.red, 'Sky Sports': C.cyan, 'The Guardian': C.emerald };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && articles.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '12px 14px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ width: '70%', height: 13, borderRadius: 4, background: '#1a1a24', marginBottom: 8, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ width: '90%', height: 10, borderRadius: 4, background: '#1a1a24', animation: 'pulse 1.4s ease infinite' }} />
              </div>
            ))
          : articles.map((a, i) => (
            <div
              key={i}
              onClick={() => setSelectedArticle(a)}
              style={{ padding: '12px 14px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontFamily: FONT, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                  color: sourceColor[a.source] || C.grey, background: `${sourceColor[a.source] || C.grey}18`,
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {a.source}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 9, color: C.grey }}>
                  {a.published_at ? new Date(a.published_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}
                </span>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.white, lineHeight: 1.35, marginBottom: 4 }}>
                {a.title}
              </div>
              {a.summary && (
                <div style={{ fontFamily: FONT, fontSize: 11, color: C.grey, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {a.summary}
                </div>
              )}
            </div>
          ))
        }
        {!loading && articles.length === 0 && <EmptyState msg="No EPL news available right now." />}
        {!loading && articles.length < total && (
          <button
            onClick={() => fetchNews(offset)}
            style={{ padding: '10px 0', background: C.cyanDim, border: `1px solid ${C.cyan}30`, borderRadius: 10, color: C.cyan, fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Load more
          </button>
        )}
      </div>

      {/* ── In-app article overlay — portalled to body to escape backdrop-filter containing block ── */}
      {selectedArticle && createPortal(
        <div
          onClick={() => setSelectedArticle(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxHeight: '85vh',
              background: '#13131e',
              borderRadius: '20px 20px 0 0',
              border: `1px solid ${C.border}`,
              borderBottom: 'none',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>
              {/* Source + date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                  color: sourceColor[selectedArticle.source] || C.grey,
                  background: `${sourceColor[selectedArticle.source] || C.grey}18`,
                  padding: '3px 8px', borderRadius: 4,
                }}>
                  {selectedArticle.source || 'Unknown source'}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 10, color: C.grey }}>
                  {selectedArticle.published_at
                    ? new Date(selectedArticle.published_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })
                    : ''}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: C.white, lineHeight: 1.3, marginBottom: 14 }}>
                {selectedArticle.title || 'Untitled article'}
              </div>

              {/* Summary */}
              {(selectedArticle.summary || selectedArticle.description) && (
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.greyLight, lineHeight: 1.6, marginBottom: 24 }}>
                  {selectedArticle.summary || selectedArticle.description}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ padding: '12px 20px 32px', display: 'flex', gap: 10, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button
                onClick={() => setSelectedArticle(null)}
                style={{
                  flex: 1, padding: '13px 0',
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                  borderRadius: 12, color: C.grey,
                  fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Close
              </button>
              {selectedArticle.url ? (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 2, padding: '13px 0',
                    background: C.cyanDim, border: `1px solid ${C.cyan}50`,
                    borderRadius: 12, color: C.cyan,
                    fontFamily: FONT, fontSize: 13, fontWeight: 800,
                    textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Read on {selectedArticle.source || 'source'} ↗
                </a>
              ) : (
                <div style={{
                  flex: 2, padding: '13px 0',
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  borderRadius: 12, color: C.grey,
                  fontFamily: FONT, fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  No link available
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/* ─────────────────────────────────────────────
   FPL TAB (EPL only)
   ───────────────────────────────────────────── */
const FplTab = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('fpl_transfers')
      .select('*')
      .order('transfers_in_event', { ascending: false })
      .limit(20)
      .then(({ data }) => { setPlayers(data || []); setLoading(false); });
  }, []);

  const maxTransfers = players[0]?.transfers_in_event || 1;

  const heatTrack = 'rgba(255,255,255,0.07)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: C.grey, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
        🔥 Most Transferred In This Week
      </div>
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ width: 46, height: 46, borderRadius: 8, background: '#1a1a24', animation: 'pulse 1.4s ease infinite', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '55%', height: 11, borderRadius: 4, background: '#1a1a24', marginBottom: 7, animation: 'pulse 1.4s ease infinite' }} />
                <div style={{ width: '35%', height: 9, borderRadius: 4, background: '#1a1a24', animation: 'pulse 1.4s ease infinite' }} />
              </div>
            </div>
          ))
        : players.map((p, i) => {
            const heat = maxTransfers > 0 ? (p.transfers_in_event / maxTransfers) * 100 : 0;
            const hotForm = parseFloat(p.form) > 7.0;
            return (
              <div key={p.player_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p.photo_url} alt={p.web_name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', background: '#1a1a24' }} loading="lazy" />
                  <span style={{ position: 'absolute', top: -5, left: -5, width: 18, height: 18, borderRadius: '50%', background: C.amber, color: '#000', fontFamily: FONT, fontWeight: 900, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.web_name}</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: hotForm ? C.emerald : C.grey, flexShrink: 0, boxShadow: hotForm ? `0 0 5px rgba(52,211,153,0.6)` : 'none' }} />
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: C.grey }}>{p.team_name} · £{p.now_cost}m · {p.total_points}pts</span>
                  <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: heatTrack, overflow: 'hidden' }}>
                    <div style={{ width: `${heat}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${C.cyan}, ${C.amber})`, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: C.cyan, lineHeight: 1, textShadow: `0 0 10px ${C.cyanGlow}` }}>
                    {(p.transfers_in_event ?? 0).toLocaleString()}
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 8, color: C.grey, textTransform: 'uppercase', letterSpacing: '0.5px' }}>in</span>
                </div>
              </div>
            );
          })
      }
      {!loading && players.length === 0 && <EmptyState msg="FPL market data updates during gameweeks. Check back closer to a matchday." />}
    </div>
  );
};

/* ─────────────────────────────────────────────
   EMPTY STATE
   ───────────────────────────────────────────── */
const EmptyState = ({ msg }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: FONT, fontSize: 13, color: C.grey }}>
    {msg}
  </div>
);

/* ─────────────────────────────────────────────
   MAIN LEAGUE HUB
   ───────────────────────────────────────────── */
const LeagueHub = () => {
  const navigate = useNavigate();
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES[0]); // EPL default
  const [activeTab, setActiveTab] = useState('standings');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When league changes, reset to first valid tab
  const handleLeagueChange = (league) => {
    setSelectedLeague(league);
    setDropdownOpen(false);
    // If current tab is EPL-only and we're switching to non-EPL, revert to standings
    if (league.id !== EPL_ID && (activeTab === 'news' || activeTab === 'fpl')) {
      setActiveTab('standings');
    }
  };

  const visibleTabs = TABS.filter(t => !t.eplOnly || selectedLeague.id === EPL_ID);

  const renderTab = () => {
    switch (activeTab) {
      case 'standings': return <StandingsTab leagueId={selectedLeague.id} />;
      case 'fixtures':  return <FixturesTab  leagueId={selectedLeague.id} />;
      case 'scorers':   return <ScorersTab   leagueId={selectedLeague.id} />;
      case 'bench':     return <BenchTab     leagueId={selectedLeague.id} />;
      case 'news':      return <NewsTab />;
      case 'fpl':       return <FplTab />;
      default:          return null;
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        * { box-sizing: border-box; }
        @media (max-width: 360px) { .gd-col { display: none !important; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, padding: '14px 16px 0', background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => navigate('/manager-office')}
            style={{ background: 'none', border: 'none', color: C.cyan, cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <ArrowLeft size={22} />
          </button>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: C.white, letterSpacing: '0.5px' }}>
            League Hub
          </span>
        </div>

        {/* ── League Selector ── */}
        <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 12 }}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: C.surface,
              border: `1px solid ${dropdownOpen ? C.cyan + '60' : C.border}`,
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.white }}>
              {selectedLeague.flag} {selectedLeague.name}
            </span>
            <ChevronDown size={16} color={C.grey} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              marginTop: 4,
              background: '#13131e',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              {LEAGUES.map(league => (
                <button
                  key={league.id}
                  onClick={() => handleLeagueChange(league)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    background: league.id === selectedLeague.id ? C.cyanDim : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{league.flag}</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: league.id === selectedLeague.id ? C.cyan : C.white }}>
                    {league.name}
                  </span>
                  {league.id === selectedLeague.id && (
                    <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: C.cyan }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          paddingBottom: 12,
        }}>
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 12px',
                  borderRadius: 20,
                  border: `1px solid ${active ? C.cyan + '50' : C.border}`,
                  background: active ? C.cyanDim : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={12} color={active ? C.cyan : C.grey} />
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: active ? C.cyan : C.grey, whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px' }}>
        <div style={{
          background: C.glass,
          backdropFilter: 'blur(20px)',
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          padding: '14px 12px',
          marginBottom: 24,
        }}>
          {renderTab()}
        </div>
      </div>
    </div>
  );
};

export default LeagueHub;
