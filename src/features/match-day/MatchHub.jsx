import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext'; // Required for Supabase client

const MatchHub = () => {
  const navigate = useNavigate();
  const { supabase } = useGame(); // Use central Supabase client

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper: Format date as YYYY-MM-DD
  const dateString = selectedDate.toISOString().split('T')[0];

  const fetchMatchesFromCache = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // 1. Fetch from our NEW source of truth table
      const { data, error } = await supabase
        .from('matches_live')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error("Cache fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesFromCache();

    // 2. REAL-TIME: Listen for score updates while user has page open
    const channel = supabase
      .channel('live-scores')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches_live' },
        (payload) => {
          setMatches(prev =>
            prev.map(m => m.match_id === payload.new.match_id ? payload.new : m)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateString, supabase]);

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Status Helpers
  const isLive = (status) => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(status);
  const isFinished = (status) => ['FT', 'AET', 'PEN'].includes(status);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-black/80 backdrop-blur-md border-b border-white/10 p-4 z-50">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate('/manager-office')} className="p-2 bg-white/10 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest text-emerald-400">Match Hub</h1>
          <div className="w-9"></div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-2 border border-white/10">
          <button onClick={() => changeDate(-1)} className="p-2"><ChevronLeft className="w-5 h-5 text-zinc-400" /></button>
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-sm">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2"><ChevronRight className="w-5 h-5 text-zinc-400" /></button>
        </div>
      </div>

      {/* Match List */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
        ) : matches.length > 0 ? (
          matches.map((match) => (
            <div
              key={match.match_id}
              onClick={() => navigate(`/match/${match.match_id}`)}
              className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-all"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Live Feed</span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isLive(match.status) ? 'text-red-500 border-red-500/20 bg-red-500/10' : 'text-zinc-500 border-zinc-700'}`}>
                  {isLive(match.status) && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                  <span className="text-[9px] font-black">{match.status}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex-1 text-center font-bold">{match.home_score}</div>
                <div className="px-4 text-zinc-500 text-xs font-mono uppercase">Score</div>
                <div className="flex-1 text-center font-bold">{match.away_score}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-zinc-500 font-bold uppercase tracking-widest">No Active Matches Found</div>
        )}
      </div>
    </div>
  );
};

export default MatchHub;