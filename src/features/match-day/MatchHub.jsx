import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';

// HELPER: Strict Date Comparison
const isSameDay = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

const MatchHub = () => {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/matches');
        const data = await res.json();
        const fetchedMatches = data.response || [];
        setMatches(fetchedMatches);

        // SMART DATE LOGIC:
        // Check if the current selectedDate has matches. If not, find the next best one.
        // We do this BEFORE setting loading to false.
        if (fetchedMatches.length > 0) {
          // Check against the initial 'selectedDate' (which is Today on first render)
          // We use a temp date object here because state updates are async
          let targetDate = new Date();
          const hasMatchesToday = fetchedMatches.some(m => isSameDay(m.fixture.date, targetDate));

          if (!hasMatchesToday) {
            // If no matches today, force update to the first available match date
            targetDate = new Date(fetchedMatches[0].fixture.date);
            setSelectedDate(targetDate);
          }
        }
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        // Only reveal the UI once we've decided on the date
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Filter based on the (potentially updated) selectedDate
  const displayedMatches = matches.filter(match =>
    isSameDay(match.fixture.date, selectedDate)
  );

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans select-none">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-black uppercase tracking-widest">Match Hub</h1>
          <div className="w-9"></div>
        </div>
        {/* Date Controls */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-2 border border-white/10">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5 text-zinc-400" /></button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-yellow-500" />
            <span className="font-bold font-mono text-sm">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronRight className="w-5 h-5 text-zinc-400" /></button>
        </div>
      </div>

      {/* Match List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-yellow-500" /></div>
        ) : displayedMatches.length > 0 ? (
          displayedMatches.map((match) => (
            <div key={match.fixture.id} onClick={() => navigate(`/match/${match.fixture.id}`)} className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-transform cursor-pointer hover:bg-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{match.league?.name || 'LEAGUE'}</span>
                <span className="text-[10px] font-mono text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
                  {new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1">
                  <img src={match.teams.home.logo} className="w-8 h-8 object-contain" alt="Home" />
                  <span className="font-bold text-sm truncate">{match.teams.home.name}</span>
                </div>
                <div className="px-3 font-mono text-zinc-600 text-xs">VS</div>
                <div className="flex items-center gap-3 flex-1 justify-end">
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