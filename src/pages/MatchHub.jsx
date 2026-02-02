import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Zap, Coins, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';
import MobileLayout from '../components/MobileLayout';
import { toast, Toaster } from 'sonner';

const MatchHub = () => {
  const navigate = useNavigate();
  const { userProfile, loading: gameLoading } = useGame();

  const [matches, setMatches] = useState([]);
  const [currentRound, setCurrentRound] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  // DATE PICKER STATE
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateList, setDateList] = useState([]);
  const [isDateMode, setIsDateMode] = useState(false); // Toggle between round mode and date mode

  // CONFIGURATION
  const LEAGUE_ID = 39;
  const SEASON = 2025;

  // Ref to track timeout ID for cleanup
  const pollingTimeoutRef = useRef(null);
  const dateScrollRef = useRef(null);

  // Generate ±7 day date list
  useEffect(() => {
    const generateDateList = () => {
      const dates = [];
      const today = new Date();

      for (let i = -7; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }

      setDateList(dates);
    };

    generateDateList();
  }, []);

  // Auto-center selected date in date picker
  useEffect(() => {
    if (!dateScrollRef.current || dateList.length === 0) return;

    // Find the index of the selected date
    const selectedIndex = dateList.findIndex(date =>
      date.toDateString() === selectedDate.toDateString()
    );

    if (selectedIndex === -1) return;

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const container = dateScrollRef.current;
      if (!container) return;

      const buttons = container.querySelectorAll('button');
      const activeButton = buttons[selectedIndex];

      if (activeButton) {
        // Calculate scroll position to center the button
        const scrollLeft =
          activeButton.offsetLeft -
          (container.offsetWidth / 2) +
          (activeButton.offsetWidth / 2);

        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }, 100);
  }, [selectedDate, dateList]);

  // Format date to YYYY-MM-DD
  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

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

        // Build URL based on mode
        let url;
        if (isDateMode) {
          const dateStr = formatDateForAPI(selectedDate);
          url = `/api/matches?league=${LEAGUE_ID}&season=${SEASON}&date=${dateStr}`;
          console.log(`📅 Fetching matches for date: ${dateStr}`);
        } else {
          url = `/api/matches?league=${LEAGUE_ID}&season=${SEASON}`;
          console.log(`🔄 Fetching current round matches`);
        }

        const response = await fetch(url);

        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

        const data = await response.json();

        // TRANSPARENT ERROR HANDLING: Detect API errors
        if (data.error) {
          console.error('API Error detected:', data.error, data.message);

          // DEV ALERT: Show toast on localhost only
          if (import.meta.env.DEV) {
            if (data.error === 'API_LIMIT_REACHED') {
              toast.error('⚠️ DEV ALERT: API Quota Exceeded', {
                description: data.message,
                duration: 5000,
              });
            } else if (data.error === 'API_UNAVAILABLE') {
              toast.warning('⚠️ DEV ALERT: API Unavailable', {
                description: data.message,
                duration: 5000,
              });
            }
          }

          // USER VIEW: Set empty matches (will show friendly empty state)
          setMatches([]);
          setError(null); // Don't show error UI, show empty state instead

          // Still schedule next poll (only in round mode)
          if (!isDateMode) {
            const delay = calculateNextDelay([]);
            pollingTimeoutRef.current = setTimeout(fetchMatches, delay);
          }
          return;
        }

        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error("API refused connection");
        }

        // The backend tells us the active round name (only in round mode)
        if (!isDateMode && data.active_round) {
          setCurrentRound(data.active_round.replace("Regular Season - ", "Matchweek "));
        } else if (isDateMode) {
          setCurrentRound(''); // Clear round name in date mode
        }

        // The backend returns the matches in 'response'
        const matchesData = data.response || [];

        // Client-side sort by date
        const sortedMatches = matchesData.sort((a, b) =>
          new Date(a.fixture.date) - new Date(b.fixture.date)
        );

        setMatches(sortedMatches);

        // Calculate next delay and schedule next poll (only in round mode)
        if (!isDateMode) {
          const delay = calculateNextDelay(sortedMatches);
          pollingTimeoutRef.current = setTimeout(fetchMatches, delay);
        }

      } catch (err) {
        console.error("Fetch error:", err);
        setError("Could not load matches.");

        // Retry after 5 minutes on error (only in round mode)
        if (!isDateMode) {
          console.log('❌ Error occurred - Retry in 5 minutes');
          pollingTimeoutRef.current = setTimeout(fetchMatches, 5 * 60 * 1000);
        }
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
  }, [isDateMode, selectedDate]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setIsDateMode(true);
  };

  // Handle back to current round
  const handleBackToRound = () => {
    setIsDateMode(false);
    setSelectedDate(new Date());
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
      {/* Toast Notifications (Dev only) */}
      <Toaster position="top-center" richColors closeButton />

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

        {/* DATE PICKER STRIP */}
        <div className="absolute top-24 left-0 w-full z-20 px-4">
          <div className="flex items-center gap-2 mb-2">
            {isDateMode && (
              <button
                onClick={handleBackToRound}
                className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full border border-yellow-500/30 text-yellow-500 text-[9px] font-bold uppercase tracking-wide hover:bg-yellow-500/30 transition-all active:scale-95"
              >
                <ChevronLeft className="w-3 h-3" />
                Current
              </button>
            )}
            <div ref={dateScrollRef} className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 pb-2">
                {dateList.map((date, index) => {
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNumber = date.getDate();
                  const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(date)}
                      className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-lg border transition-all active:scale-95 ${isSelected(date)
                        ? 'bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/30'
                        : isToday(date)
                          ? 'bg-white/10 border-white/20 hover:bg-white/15'
                          : 'bg-black/40 border-white/10 hover:bg-black/50'
                        }`}
                    >
                      <span className={`text-[9px] font-bold uppercase tracking-wide ${isSelected(date) ? 'text-black' : 'text-gray-400'
                        }`}>
                        {dayName}
                      </span>
                      <span className={`text-lg font-black ${isSelected(date) ? 'text-black' : 'text-white'
                        }`}>
                        {dayNumber}
                      </span>
                      <span className={`text-[8px] font-bold ${isSelected(date) ? 'text-black/70' : 'text-gray-500'
                        }`}>
                        {monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* MATCH LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-44 pb-20 px-0 no-scrollbar">

          {!isDateMode && currentRound && (
            <div className="px-1 mb-2 text-center">
              <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold bg-black/40 px-3 py-1 rounded-full border border-white/5">
                {currentRound}
              </span>
            </div>
          )}

          {isDateMode && (
            <div className="px-1 mb-2 text-center">
              <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold bg-black/40 px-3 py-1 rounded-full border border-white/5">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

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
            <div className="text-center p-8 mx-4 rounded-xl border border-yellow-500/30 bg-gradient-to-b from-yellow-900/20 to-gray-900/40 backdrop-blur-sm">
              <div className="mb-4 relative">
                <div className="w-20 h-20 mx-auto bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-yellow-500 opacity-60" />
                </div>
              </div>
              <p className="text-yellow-200 text-base font-black mb-2 uppercase tracking-wide">
                {isDateMode ? 'No Matches Scheduled' : 'Locker Room Quiet'}
              </p>
              <p className="text-gray-400 text-sm mb-1">
                {isDateMode
                  ? `No fixtures on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'No matches scheduled at the moment'
                }
              </p>
              <p className="text-gray-500 text-xs">
                {isDateMode ? 'Try selecting a different date' : 'Check back soon for upcoming fixtures'}
              </p>
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