import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useGame } from '../../shared/context/GameContext';
import { SUPPORTED_LEAGUE_IDS } from '../../shared/config/coverage';

const MatchHub = () => {
  const navigate = useNavigate();
  const { supabase } = useGame();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper: Format date as YYYY-MM-DD
  const dateString = selectedDate.toISOString().split('T')[0];

  const fetchMatchesFromCache = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // 1. Fetch from source of truth, FILTERING by current coverage
      const { data, error } = await supabase
        .from('matches_live')
        .select('*')
        .in('league_id', SUPPORTED_LEAGUE_IDS) // This removes Saudi matches (307) automatically
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

    // 2. REAL-TIME: Listen for score updates to existing rows
    const channel = supabase
      .channel('live-scores')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches_live' },
        (payload) => {
          // Only update if the league is still supported
          if (SUPPORTED_LEAGUE_IDS.includes(payload.new.league_id)) {
            setMatches(prev =>
              prev.map(m => m.match_id === payload.new.match_id ? payload.new : m)
            );
          }
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

  return (
    // FIXED: h-[100dvh] and flex-col for smooth mobile scrolling
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white font-sans select-none overflow-hidden">

      {/* FIXED HEADER */}
      <div className="flex-none bg-black/80 backdrop-blur-md border-b border-white/10 p-4 z-50">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => navigate('/manager-office')} className="p-2 bg-white/10 rounded-full active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest text-emerald-400">Match Hub</h1>
          <div className="w-9"></div>
        </div>

        <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-2 border border-white/10">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5 text-zinc-400" /></button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="font-bold font-mono text-sm">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </span>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg"><ChevronRight className="w-5 h-5 text-zinc-400" /></button>
        </div>
      </div>

      {/* SCROLLABLE LIST AREA */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-3 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
        ) : matches.length > 0 ? (
          matches.map((match) => (
            <div
              key={match.match_id}
              onClick={() => navigate(`/match/${match.match_id}`)}
              className="bg-zinc-900 border border-white/10 rounded-xl p-4 active:scale-95 transition-all cursor-pointer hover:bg-zinc-800"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Live Feed</span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${isLive(match.status) ? 'text-red-500 border-red-500/20 bg-red-500/10' : 'text-zinc-500 border-zinc-700 bg-zinc-800'}`}>
                  {isLive(match.status) && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                  <span className="text-[9px] font-black">{match.status}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex-1 text-center font-black text-2xl">{match.home_score}</div>
                <div className="px-6 text-zinc-600 text-[10px] font-black uppercase tracking-tighter">Score</div>
                <div className="flex-1 text-center font-black text-2xl">{match.away_score}</div>
              </div>

              <div className="mt-3 flex justify-center">
                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Tap for Details</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 opacity-50">
            <span className="text-4xl mb-4">📅</span>
            <p className="font-bold text-sm">No Matches in Coverage</p>
            <p className="text-[10px] text-zinc-500">Saudi league data has been removed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchHub;