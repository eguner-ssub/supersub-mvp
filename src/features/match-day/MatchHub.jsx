import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';

// HELPER: Format date as YYYY-MM-DD for API
const formatDateForAPI = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const MatchHub = () => {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive a stable date string for fetch dependency
  const dateString = formatDateForAPI(selectedDate);

  // Fetch matches whenever dateString changes
  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        // Pass the selected date as a query parameter
        const res = await fetch(`/api/matches?date=${dateString}`);
        const data = await res.json();

        // API now returns only matches for the specified date - no client-side filtering needed
        const fetchedMatches = data.response || [];
        setMatches(fetchedMatches);

        console.log(`📅 [MatchHub] Fetched ${fetchedMatches.length} matches for ${dateString}`);
      } catch (err) {
        console.error("Fetch failed", err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [dateString]); // Stable string dependency

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Helper to determine if a match is currently active
  const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);

  // Helper to determine if match has not started
  const isNotStarted = (status) => ['NS', 'TBD'].includes(status);

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans select-none">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest">Match Hub</h1>
          <div className="w-9"></div>
        </div>
        {/* Date Controls */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-2 border border-white/10">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-yellow-500" />
            <span className="font-bold font-mono text-sm">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg active:scale-95 transition-all">
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Match List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-yellow-500" /></div>
        ) : matches.length > 0 ? (
          matches.map((match) => (
            <div
              key={match.fixture.id}
              onClick={() => navigate(`/match/${match.fixture.id}`)}
              className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-transform cursor-pointer hover:bg-zinc-800"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{match.league?.name || 'LEAGUE'}</span>

                {/* STATUS BADGE: Show LIVE or Kick-off time */}
                <div className="flex items-center gap-2">
                  {isLive(match.fixture.status.short) ? (
                    <div className="flex items-center gap-1.5 bg-red-600/20 px-2 py-0.5 rounded border border-red-600/30 animate-pulse">
                      <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                      <span className="text-[9px] font-black text-red-500 uppercase italic">Live</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
                      {new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center">
                {/* Home Team */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img src={match.teams.home.logo} className="w-8 h-8 object-contain" alt="Home" />
                  <span className="font-bold text-sm truncate">{match.teams.home.name}</span>
                </div>

                {/* MIDDLE SECTION: Show Score if Live/Finished, else VS */}
                <div className="px-4 min-w-[70px] flex flex-col items-center justify-center">
                  {!isNotStarted(match.fixture.status.short) ? (
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-lg font-black text-white leading-none tracking-tighter">
                        {match.goals.home} - {match.goals.away}
                      </span>
                      {match.fixture.status.elapsed && isLive(match.fixture.status.short) && (
                        <span className="text-[8px] font-bold text-yellow-500 mt-1">{match.fixture.status.elapsed}'</span>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono text-zinc-600 text-xs">VS</span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                  <span className="font-bold text-sm truncate text-right">{match.teams.away.name}</span>
                  <img src={match.teams.away.logo} className="w-8 h-8 object-contain" alt="Away" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <span className="text-4xl mb-2">📅</span>
            <p className="font-bold">No Matches Found</p>
            <p className="text-xs text-zinc-500">Try checking upcoming dates.</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default MatchHub;