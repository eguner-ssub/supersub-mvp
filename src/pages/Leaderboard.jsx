import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Flag, Trophy, Loader2, Crown, Medal, Award } from 'lucide-react';
import { useGame } from '../shared/context/GameContext';

const LEAGUE_OPTIONS = [
  { scope: '8',   name: 'Premier League' },
  { scope: '9',   name: 'Championship' },
  { scope: '82',  name: 'Bundesliga' },
  { scope: '564', name: 'La Liga' },
  { scope: '384', name: 'Serie A' },
];

const PERIODS = [
  { id: 'all_time', label: 'All Time' },
  { id: 'season',   label: 'Season' },
  { id: 'weekly',   label: 'Week' },
  { id: 'monthly',  label: 'Month' },
];

const TYPES = [
  { id: 'global',  label: 'Global',  icon: Globe },
  { id: 'country', label: 'Country', icon: Flag },
  { id: 'league',  label: 'League',  icon: Trophy },
];

function RankBadge({ rank }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-mono text-gray-400 w-5 text-center">{rank}</span>;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { userProfile, supabase } = useGame();

  const [type, setType] = useState('global');
  const [period, setPeriod] = useState('all_time');
  const [leagueScope, setLeagueScope] = useState('8');

  const [entries, setEntries] = useState([]);
  const [yourEntry, setYourEntry] = useState(null);
  const [leaderboardMeta, setLeaderboardMeta] = useState(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ type, period, limit: '100' });
      if (type === 'league') params.set('scope', leagueScope);
      if (type === 'country' && userProfile?.country_code) {
        params.set('scope', userProfile.country_code);
      }

      const headers = {};
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch(`/api/leaderboard?${params}`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setEntries(data.entries || []);
      setYourEntry(data.your_entry || null);
      setLeaderboardMeta(data.leaderboard || null);
      setTotalEntries(data.total_entries || 0);
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [type, period, leagueScope, userProfile?.country_code, supabase]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const isYou = (userId) => userId === userProfile?.id;
  const yourRankVisible = yourEntry && entries.some(e => e.user_id === userProfile?.id);

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a0a] overflow-hidden font-sans select-none md:max-w-[480px] md:mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-6 bg-black/60 backdrop-blur-md border-b border-white/10 z-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-black text-white uppercase tracking-widest">
          {leaderboardMeta?.name || 'Leaderboard'}
        </h1>
        <div className="w-7" />
      </div>

      {/* Type Selector */}
      <div className="flex gap-1 p-3 pb-0">
        {TYPES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setType(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              type === id
                ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : 'bg-white/5 text-gray-400 active:bg-white/10'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* League Selector (only when type=league) */}
      {type === 'league' && (
        <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto scrollbar-hide">
          {LEAGUE_OPTIONS.map((league) => (
            <button
              key={league.scope}
              onClick={() => setLeagueScope(league.scope)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                leagueScope === league.scope
                  ? 'bg-green-500 text-black'
                  : 'bg-white/5 text-gray-400 active:bg-white/10'
              }`}
            >
              {league.name}
            </button>
          ))}
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-1 p-3">
        {PERIODS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setPeriod(id)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              period === id
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-gray-500 active:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="mt-4 px-4 py-2 bg-white/10 text-white text-xs font-bold uppercase rounded-lg active:bg-white/20"
            >
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">No rankings yet</p>
            <p className="text-gray-600 text-xs mt-1">Place at least 5 bets to qualify</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Top 3 Podium */}
            {entries.length >= 3 && (
              <div className="flex items-end justify-center gap-2 pt-2 pb-4">
                {/* 2nd Place */}
                <PodiumCard entry={entries[1]} rank={2} isYou={isYou(entries[1]?.user_id)} />
                {/* 1st Place */}
                <PodiumCard entry={entries[0]} rank={1} isYou={isYou(entries[0]?.user_id)} />
                {/* 3rd Place */}
                <PodiumCard entry={entries[2]} rank={3} isYou={isYou(entries[2]?.user_id)} />
              </div>
            )}

            {/* Remaining Entries */}
            {entries.slice(entries.length >= 3 ? 3 : 0).map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isYou(entry.user_id)
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-white/[0.03] border border-transparent'
                }`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${isYou(entry.user_id) ? 'text-yellow-400' : 'text-white'}`}>
                    {entry.club_name}
                    {isYou(entry.user_id) && <span className="text-[10px] text-yellow-500/70 ml-1.5 font-normal">YOU</span>}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {entry.win_count}W / {entry.bet_count} bets
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-mono font-bold ${isYou(entry.user_id) ? 'text-yellow-400' : 'text-white'}`}>
                    {entry.points.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500">pts</p>
                </div>
              </div>
            ))}

            {/* Total count */}
            {totalEntries > 0 && (
              <p className="text-center text-[10px] text-gray-600 pt-2 uppercase tracking-widest">
                {totalEntries} managers ranked
              </p>
            )}
          </div>
        )}
      </div>

      {/* Your Rank Footer (if not visible in list) */}
      {yourEntry && !yourRankVisible && (
        <div className="border-t border-white/10 bg-black/80 backdrop-blur-md px-4 py-3">
          <div className="flex items-center gap-3">
            <RankBadge rank={yourEntry.rank} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-400 truncate">
                {userProfile?.club_name || 'You'}
                <span className="text-[10px] text-yellow-500/70 ml-1.5 font-normal">YOU</span>
              </p>
              <p className="text-[10px] text-gray-500">
                {yourEntry.win_count}W / {yourEntry.bet_count} bets
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-bold text-yellow-400">
                {yourEntry.points.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-500">pts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ entry, rank, isYou }) {
  if (!entry) return null;

  const heights = { 1: 'h-28', 2: 'h-22', 3: 'h-20' };
  const colors = {
    1: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
    2: 'from-gray-400/15 to-gray-400/5 border-gray-400/20',
    3: 'from-amber-600/15 to-amber-600/5 border-amber-600/20',
  };
  const textColors = {
    1: 'text-yellow-400',
    2: 'text-gray-300',
    3: 'text-amber-500',
  };

  return (
    <div className={`flex flex-col items-center ${rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'}`}>
      <RankBadge rank={rank} />
      <div className={`w-24 ${heights[rank]} mt-1 bg-gradient-to-t ${colors[rank]} border rounded-xl flex flex-col items-center justify-center px-1`}>
        <p className={`text-xs font-bold truncate w-full text-center ${isYou ? 'text-yellow-400' : 'text-white'}`}>
          {entry.club_name}
        </p>
        <p className={`text-lg font-mono font-black ${textColors[rank]}`}>
          {entry.points.toLocaleString()}
        </p>
        <p className="text-[9px] text-gray-500">{entry.win_count}W / {entry.bet_count}</p>
      </div>
    </div>
  );
}
