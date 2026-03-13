import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const MatchHub = () => {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  // Helper: Format date for the API (YYYY-MM-DD)
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

  const displayedMatches = showLiveOnly
    ? matches.filter(m => isLive(m.status))
    : matches;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white font-sans select-none overflow-hidden">

      {/* HEADER */}
      <div className="flex-none bg-black/80 backdrop-blur-md border-b border-white/10 p-4 z-50">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate('/manager-office')}
            className="p-2 bg-white/10 rounded-full active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-black uppercase tracking-widest text-emerald-400">Match Hub</h1>

          <button
            onClick={() => setShowLiveOnly(!showLiveOnly)}
            className={`px-3 py-1 rounded-lg border transition-all text-[10px] font-black tracking-tighter ${showLiveOnly
              ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.3)]'
              : 'bg-zinc-900 border-white/10 text-zinc-500'
              }`}
          >
            LIVE
          </button>
        </div>

        {/* Date Picker */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-2 border border-white/10">
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
      </div>

      {/* MATCH LIST */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-3 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
          </div>
        ) : displayedMatches.length > 0 ? (
          displayedMatches.map((match) => {
            const status = match.status || match.raw_data?.fixture?.status?.short || 'NS';
            const matchId = match.id || match.raw_data?.fixture?.id;
            const isMatchLive = isLive(status);
            const isMatchFinished = isFinished(status);

            const homeLogo = match.home_logo || match.raw_data?.teams?.home?.logo;
            const awayLogo = match.away_logo || match.raw_data?.teams?.away?.logo;
            const homeName = match.home_team || match.raw_data?.teams?.home?.name || 'Home';
            const awayName = match.away_team || match.raw_data?.teams?.away?.name || 'Away';
            const leagueName = match.league_name || match.raw_data?.league?.name || '';
            const homeScore = match.home_score ?? match.raw_data?.goals?.home ?? 0;
            const awayScore = match.away_score ?? match.raw_data?.goals?.away ?? 0;
            const kickoff = match.kickoff_time || match.raw_data?.fixture?.date;
            const elapsed = match.raw_data?.fixture?.status?.elapsed;

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
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isMatchLive ? 'text-red-500 border-red-500/20 bg-red-500/10' : 'text-zinc-500 border-zinc-700 bg-zinc-800'
                    }`}>
                    {isMatchLive && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                    <span className="text-[9px] font-black">
                      {status === 'NS' && kickoff
                        ? new Date(kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  {/* Home Team */}
                  <div className="flex flex-col items-center flex-[1.2] min-w-0">
                    {homeLogo && <img src={homeLogo} className="w-10 h-10 object-contain mb-1" alt="home" />}
                    <span className="text-[11px] font-bold text-center truncate w-full uppercase">
                      {homeName}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="px-2 flex flex-col items-center justify-center min-w-[60px]">
                    <div className="text-2xl font-black font-mono tracking-tighter">
                      {status === 'NS' ? 'VS' : `${homeScore} - ${awayScore}`}
                    </div>
                    {isMatchLive && elapsed && (
                      <span className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">
                        {elapsed}'
                      </span>
                    )}
                    {isMatchFinished && <span className="text-[8px] text-zinc-500 font-bold uppercase mt-1">Final</span>}
                  </div>

                  {/* Away Team */}
                  <div className="flex flex-col items-center flex-[1.2] min-w-0">
                    {awayLogo && <img src={awayLogo} className="w-10 h-10 object-contain mb-1" alt="away" />}
                    <span className="text-[11px] font-bold text-center truncate w-full uppercase">
                      {awayName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 opacity-40 text-center">
            <span className="text-4xl mb-4">📅</span>
            <p className="font-bold text-sm text-zinc-400 uppercase tracking-widest">No Matches Found</p>
            <p className="text-[10px] text-zinc-600 uppercase mt-1">Check another date</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchHub;