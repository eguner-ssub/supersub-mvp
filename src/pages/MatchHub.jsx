import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Zap, Coins, Loader2 } from 'lucide-react';
import { useGame } from '../context/GameContext';
import MobileLayout from '../components/MobileLayout';

const MatchHub = () => {
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading } = useGame();

  const [matches, setMatches] = useState([]);
  const [currentRound, setCurrentRound] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  // CONFIGURATION
  const LEAGUE_ID = 39;
  const SEASON = 2025;

  // Ref to track timeout ID for cleanup
  const pollingTimeoutRef = useRef(null);

  // Calculate next polling delay based on match states
  const calculateNextDelay = (matchesData) => {
    if (!matchesData || matchesData.length === 0) {
      console.log('📅 No matches found - Next poll in 60 minutes');
      return 60 * 60 * 1000; // 60 minutes
    }

    const now = new Date();
    const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'PEN', 'LIVE', 'P'];

    // Check for LIVE matches
    const hasLiveMatch = matchesData.some(m =>
      LIVE_STATUSES.includes(m.fixture.status.short)
    );

    if (hasLiveMatch) {
      console.log('🔴 LIVE match detected - Next poll in 30 seconds');
      return 30 * 1000; // 30 seconds
    }

    // Find earliest upcoming match
    const upcomingMatches = matchesData
      .filter(m => new Date(m.fixture.date) > now)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    if (upcomingMatches.length === 0) {
      console.log('📅 No upcoming matches - Next poll in 60 minutes');
      return 60 * 60 * 1000; // 60 minutes
    }

    const earliestMatch = upcomingMatches[0];
    const kickoffTime = new Date(earliestMatch.fixture.date);
    const hoursUntilKickoff = (kickoffTime - now) / (1000 * 60 * 60);

    // Match starting in < 3 hours
    if (hoursUntilKickoff < 3) {
      console.log(`⏰ Match starting in ${hoursUntilKickoff.toFixed(1)} hours - Next poll in 5 minutes`);
      return 5 * 60 * 1000; // 5 minutes
    }

    // Check if it's a matchday (matches today but > 3 hours away)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const hasMatchesToday = matchesData.some(m => {
      const matchDate = new Date(m.fixture.date);
      return matchDate >= todayStart && matchDate < todayEnd;
    });

    if (hasMatchesToday) {
      console.log('📆 Matchday detected (> 3 hours) - Next poll in 30 minutes');
      return 30 * 60 * 1000; // 30 minutes
    }

    // No matches today
    console.log('📅 No matches today - Next poll in 60 minutes');
    return 60 * 60 * 1000; // 60 minutes
  };

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setDataLoading(true);
        setError(null);

        // We ask the backend for the league data.
        // The backend handles the logic of finding the active round.
        const response = await fetch(
          `/api/matches?league=${LEAGUE_ID}&season=${SEASON}`
        );

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

        const data = await response.json();

        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error("API refused connection");
        }

        // The backend tells us the active round name
        if (data.active_round) {
          setCurrentRound(data.active_round.replace("Regular Season - ", "Matchweek "));
        }

        // The backend returns the matches in 'response'
        const matchesData = data.response || [];

        // Client-side sort by date
        const sortedMatches = matchesData.sort((a, b) =>
          new Date(a.fixture.date) - new Date(b.fixture.date)
        );

        setMatches(sortedMatches);

        // Calculate next delay and schedule next poll
        const delay = calculateNextDelay(sortedMatches);
        pollingTimeoutRef.current = setTimeout(fetchMatches, delay);

      } catch (err) {
        console.error("Fetch error:", err);
        setError("Could not load matches.");

        // Retry after 5 minutes on error
        console.log('❌ Error occurred - Retry in 5 minutes');
        pollingTimeoutRef.current = setTimeout(fetchMatches, 5 * 60 * 1000);
      } finally {
        setDataLoading(false);
      }
    };

    // Initial fetch (immediate)
    fetchMatches();

    // Cleanup function
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        console.log('🧹 Polling cleanup - timeout cleared');
      }
    };
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // SAFETY SHIELD
  if (gameLoading || !userProfile) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  const userData = userProfile;

  return (
    <MobileLayout bgImage="/bg-stadium.webp">

      <div className="w-full h-full flex flex-col relative font-sans select-none">

        {/* HEADER */}
        <div className="absolute top-0 left-0 w-full p-4 pt-4 flex justify-between items-center z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm">{userData.energy}/{userData.max_energy}</span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 text-white text-xl font-black uppercase tracking-widest drop-shadow-md">
            {userData.club_name}
          </div>

          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg pointer-events-auto">
            <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-bold text-sm">{userData.coins}</span>
          </div>
        </div>

        {/* BACK BUTTON */}
        <div className="absolute top-14 left-4 z-20">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center w-10 h-10 bg-black/60 rounded-full backdrop-blur-md border border-white/10 hover:bg-black/80 transition-all active:scale-95 shadow-lg group"
          >
            <ArrowLeft className="w-5 h-5 text-white/70 group-hover:text-white" />
          </button>
        </div>

        {/* MATCH LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-24 pb-20 px-0 no-scrollbar">

          <div className="px-1 mb-2 text-center">
            <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold bg-black/40 px-3 py-1 rounded-full border border-white/5">
              {currentRound || "Upcoming Fixtures"}
            </span>
          </div>

          {dataLoading && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
              <p className="text-xs uppercase tracking-widest">Scouting Fixtures...</p>
            </div>
          )}

          {!dataLoading && error && (
            <div className="text-center p-6 bg-red-900/50 mx-4 rounded-xl border border-red-500/30">
              <p className="text-red-200 text-sm mb-2 font-bold">Signal Lost</p>
              <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-800 rounded text-xs text-white font-bold uppercase">Retry</button>
            </div>
          )}

          {!dataLoading && !error && matches.length === 0 && (
            <div className="text-center p-8 mx-4 rounded-xl border border-yellow-500/30 bg-yellow-900/20">
              <Calendar className="w-12 h-12 text-yellow-500 mx-auto mb-3 opacity-50" />
              <p className="text-yellow-200 text-sm font-bold mb-1">No Matches Scheduled</p>
              <p className="text-gray-400 text-xs">Check back soon for upcoming fixtures</p>
            </div>
          )}

          {!dataLoading && !error && matches.map((matchData) => {
            const { fixture, teams, goals } = matchData;
            const isCompleted = ['FT', 'AET', 'PEN'].includes(fixture.status.short);
            const isLive = ['1H', '2H', 'HT', 'ET', 'P'].includes(fixture.status.short);

            return (
              <button
                key={fixture.id}
                onClick={() => navigate(`/match/${fixture.id}`)}
                className="w-full group relative overflow-hidden rounded-lg border-y border-white/10 bg-gray-900/85 transition-all active:bg-gray-800"
              >
                <div className="relative p-3 flex items-center justify-between">
                  {/* HOME */}
                  <div className="flex flex-col items-center gap-1 w-1/3">
                    <img src={teams.home.logo} alt={teams.home.name} className="w-8 h-8 object-contain drop-shadow-md" />
                    <span className="text-white font-bold text-[10px] uppercase tracking-tight leading-none text-center truncate w-full">{teams.home.name}</span>
                  </div>

                  {/* STATUS */}
                  <div className="flex flex-col items-center justify-center w-1/3 space-y-0.5">
                    {isCompleted || isLive ? (
                      <>
                        <div className="text-2xl font-black text-white tracking-widest font-mono">{goals.home ?? 0}-{goals.away ?? 0}</div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${isLive ? 'text-red-500 animate-pulse' : 'text-green-400 bg-green-500/10'}`}>{isLive ? 'LIVE' : fixture.status.short}</span>
                      </>
                    ) : (
                      <>
                        <div className="text-xl font-black text-gray-200 tracking-wider font-mono">{formatTime(fixture.date)}</div>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase tracking-wide bg-white/5 px-1.5 py-0.5 rounded"><Calendar className="w-2.5 h-2.5" />{formatDate(fixture.date)}</div>
                      </>
                    )}
                  </div>

                  {/* AWAY */}
                  <div className="flex flex-col items-center gap-1 w-1/3">
                    <img src={teams.away.logo} alt={teams.away.name} className="w-8 h-8 object-contain drop-shadow-md" />
                    <span className="text-white font-bold text-[10px] uppercase tracking-tight leading-none text-center truncate w-full">{teams.away.name}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
};

export default MatchHub;