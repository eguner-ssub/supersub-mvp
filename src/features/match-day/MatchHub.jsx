import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Star } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';

const FILTERS = ['All', 'Live', 'Upcoming', 'Finished'];

const MatchHub = () => {
  const navigate = useNavigate();
  const { userProfile } = useGame();
  const points = userProfile?.points ?? 0;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const dateString = selectedDate.toLocaleDateString('sv-SE');

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches?date=${dateString}`);
        const data = await res.json();
        setMatches(data.response || []);
      } catch (err) {
        console.error("Fetch failed", err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [dateString]);

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isLive = (status) => ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_ET', 'INPLAY_ET_SECOND_HALF', 'INPLAY_PENALTIES', 'HT', 'BREAK', 'EXTRA_TIME_BREAK'].includes(status);
  const isFinished = (status) => ['FT', 'AET', 'FT_PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'AWARDED', 'WO'].includes(status);
  const isUpcoming = (status) => status === 'NS';

  const liveCount = matches.filter(m => isLive(m.status)).length;

  const displayedMatches = matches.filter(m => {
    if (filter === 'Live') return isLive(m.status);
    if (filter === 'Finished') return isFinished(m.status);
    if (filter === 'Upcoming') return isUpcoming(m.status);
    return true;
  });

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white font-sans select-none overflow-hidden">

      {/* HEADER */}
      <div className="flex-none bg-black/80 backdrop-blur-md border-b border-white/10 z-50">

        {/* Row 1: Back | Title | Points */}
        <div className="flex justify-between items-center px-4 pt-12 pb-3">
          <button
            onClick={() => navigate('/manager-office')}
            className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h1 className="text-base font-black uppercase tracking-widest text-emerald-400">Match Hub</h1>

          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-xs font-mono">{points}</span>
          </div>
        </div>

        {/* Row 2: Date Picker */}
        <div className="flex items-center justify-between mx-4 mb-3 bg-zinc-900 rounded-xl p-2 border border-white/10">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg active:scale-95">
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="font-bold font-mono text-sm uppercase">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg active:scale-95">
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Row 3: Status filter pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {FILTERS.map(f => {
            const isActive = filter === f;
            const isLivePill = f === 'Live';
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide border transition-all active:scale-95 ${
                  isActive
                    ? isLivePill
                      ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                      : 'bg-white text-black border-white'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                {isLivePill && isActive && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                {isLivePill && !isActive && liveCount > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                {f}
                {isLivePill && liveCount > 0 && (
                  <span className={`text-[9px] font-black px-1 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-red-500/20 text-red-400'}`}>
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MATCH LIST */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-3 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
          </div>
        ) : displayedMatches.length > 0 ? (
          displayedMatches.map((match) => {
            const status = match.status || 'NS';
            const matchId = match.id;
            const isMatchLive = isLive(status);
            const isMatchFinished = isFinished(status);

            const homeLogo = match.home_logo;
            const awayLogo = match.away_logo;
            const homeName = match.home_team || 'Home';
            const awayName = match.away_team || 'Away';
            const leagueName = match.league_name || '';
            const homeScore = match.home_score ?? 0;
            const awayScore = match.away_score ?? 0;
            const kickoff = match.kickoff_time;
            const elapsed = null;

            return (
              <div
                key={matchId}
                onClick={() => navigate(`/match/${matchId}`)}
                className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-all cursor-pointer hover:bg-zinc-800"
              >
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    {leagueName}
                  </span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isMatchLive ? 'text-red-500 border-red-500/20 bg-red-500/10' : 'text-zinc-500 border-zinc-700 bg-zinc-800'}`}>
                    {isMatchLive && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                    <span className="text-[9px] font-black">
                      {status === 'NS' && kickoff
                        ? new Date(kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ({
                            INPLAY_1ST_HALF: '1st Half',
                            INPLAY_2ND_HALF: '2nd Half',
                            INPLAY_ET: 'Extra Time',
                            INPLAY_ET_SECOND_HALF: 'Extra Time',
                            INPLAY_PENALTIES: 'Penalties',
                            EXTRA_TIME_BREAK: 'Break',
                            BREAK: 'Break',
                            HT: 'HT', FT: 'FT', AET: 'AET', FT_PEN: 'FT-P',
                            POSTPONED: 'PST', CANCELLED: 'CANC', ABANDONED: 'ABD',
                          }[status] ?? status)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex flex-col items-center flex-[1.2] min-w-0">
                    {homeLogo && <img src={homeLogo} className="w-10 h-10 object-contain mb-1" alt="home" />}
                    <span className="text-[11px] font-bold text-center truncate w-full uppercase">{homeName}</span>
                  </div>

                  <div className="px-2 flex flex-col items-center justify-center min-w-[60px]">
                    <div className="text-2xl font-black font-mono tracking-tighter">
                      {status === 'NS' ? 'VS' : `${homeScore} - ${awayScore}`}
                    </div>
                    {isMatchLive && elapsed && (
                      <span className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">{elapsed}'</span>
                    )}
                    {isMatchFinished && <span className="text-[8px] text-zinc-500 font-bold uppercase mt-1">Final</span>}
                  </div>

                  <div className="flex flex-col items-center flex-[1.2] min-w-0">
                    {awayLogo && <img src={awayLogo} className="w-10 h-10 object-contain mb-1" alt="away" />}
                    <span className="text-[11px] font-bold text-center truncate w-full uppercase">{awayName}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 opacity-40 text-center">
            <span className="text-4xl mb-4">📅</span>
            <p className="font-bold text-sm text-zinc-400 uppercase tracking-widest">No Matches Found</p>
            <p className="text-[10px] text-zinc-600 uppercase mt-1">
              {filter === 'All' ? 'Check another date' : `No ${filter.toLowerCase()} matches`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchHub;
