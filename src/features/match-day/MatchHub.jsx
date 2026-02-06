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

  const dateString = formatDateForAPI(selectedDate);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches?date=${dateString}`);
        const data = await res.json();
        const fetchedMatches = data.response || [];
        setMatches(fetchedMatches);
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

  // Status Helpers
  const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);
  const isFinished = (status) => ['FT', 'AET', 'PEN'].includes(status);
  const isNotStarted = (status) => ['NS', 'TBD'].includes(status);

  // Helper to get color for status badge
  const getStatusColor = (status) => {
    if (isLive(status)) return 'text-red-500 border-red-600/30 bg-red-600/20';
    if (isFinished(status)) return 'text-zinc-400 border-zinc-700 bg-zinc-800';
    return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans select-none relative">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate('/manager-office')}
            className="p-2 bg-white/10 rounded-full active:scale-95 transition-all"
          >
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
          matches.map((match) => {
            const status = match.fixture.status.short;
            const statusColor = getStatusColor(status);

            return (
              <div
                key={match.fixture.id}
                onClick={() => navigate(`/match/${match.fixture.id}`)}
                className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-transform cursor-pointer hover:bg-zinc-800"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{match.league?.name || 'LEAGUE'}</span>

                  {/* IMPROVED STATUS BADGE */}
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${statusColor}`}>
                    {isLive(status) && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>}
                    <span className="text-[9px] font-black uppercase italic">
                      {/* Show Time for NS, otherwise Status Code (1H, HT, FT) */}
                      {isNotStarted(status)
                        ? new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : status}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img src={match.teams.home.logo} className="w-8 h-8 object-contain" alt="Home" />
                    <span className="font-bold text-sm truncate">{match.teams.home.name}</span>
                  </div>

                  <div className="px-4 min-w-[70px] flex flex-col items-center justify-center">
                    {!isNotStarted(status) ? (
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-lg font-black text-white leading-none tracking-tighter">
                          {match.goals.home} - {match.goals.away}
                        </span>

                        {/* TIME / HT INDICATOR */}
                        {status === 'HT' ? (
                          <span className="text-[8px] font-bold text-yellow-500 mt-1 uppercase">HT</span>
                        ) : (
                          match.fixture.status.elapsed && isLive(status) && (
                            <span className="text-[8px] font-bold text-yellow-500 mt-1">{match.fixture.status.elapsed}'</span>
                          )
                        )}

                        {isFinished(status) && <span className="text-[8px] font-bold text-zinc-500 mt-1">Final</span>}
                      </div>
                    ) : (
                      <span className="font-mono text-zinc-600 text-xs">VS</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                    <span className="font-bold text-sm truncate text-right">{match.teams.away.name}</span>
                    <img src={match.teams.away.logo} className="w-8 h-8 object-contain" alt="Away" />
                  </div>
                </div>
              </div>
            );
          })
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