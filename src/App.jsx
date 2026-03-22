import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './shared/context/GameContext';
import { Loader2 } from 'lucide-react';

// Components
import NavigationShell from './shared/ui/NavigationShell';
import LoadingScreen from './components/LoadingScreen';
import { useAssetPreloader } from './hooks/useAssetPreloader';

// Pages - Eager Loading
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import InteractiveOnboarding from './pages/InteractiveOnboarding';
import MatchHub from './features/match-day/MatchHub';
import MatchDetail from './features/match-day/MatchDetail';
import Training from './pages/Training';
import LockerRoom from './features/locker-room/LockerRoom';
import CardsInPlay from './pages/CardsInPlay';
import Settings from './pages/Settings';
import Account from './pages/Account';
import CardShowcase from './pages/CardShowcase';
import CardBaseDemo from './pages/CardBaseDemo';
import CardTest from './pages/CardTest';
import CardLab from './pages/CardLab';
import GenericLab from './features/inventory/GenericLab';
import ComingSoon from './pages/ComingSoon';
import Leaderboard from './pages/Leaderboard';
import FPLMarket from './pages/FPLMarket';
import LeagueHub from './features/league-hub/LeagueHub';
import ViewLedger from './features/locker-room/ViewLedger';
import APIDebugger from './features/debug/APIDebugger';

// Pages - Eager Loading (Dashboard must not be lazy — chunk 404 on production)
import Dashboard from './pages/Dashboard';

// Pages - Lazy Loading
const ManagerOffice = lazy(() => import('./features/office/ManagerOffice'));

// --- THE BOUNCER (Security Guard) ---
const ProtectedRoute = ({ children, requireOnboarding = true }) => {
  const { userProfile, loading } = useGame();

  const isLoggingIn =
    window.location.hash.includes('access_token') ||
    window.location.search.includes('token=') ||
    window.location.search.includes('type=magiclink');

  if (loading || isLoggingIn) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding && !userProfile.club_name) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/intro" element={<InteractiveOnboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <NavigationShell>
              <Dashboard />
            </NavigationShell>
          </ProtectedRoute>
        }
      />

      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />

      {/* MATCH HUB - UPDATED TO INCLUDE NAVIGATION SHELL */}
      <Route
        path="/match-hub"
        element={
          <ProtectedRoute>
            <NavigationShell>
              <MatchHub />
            </NavigationShell>
          </ProtectedRoute>
        }
      />

      <Route path="/match/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><LockerRoom /></ProtectedRoute>} />
      <Route path="/inventory/active" element={<ProtectedRoute><CardsInPlay /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route
        path="/manager-office"
        element={
          <ProtectedRoute>
            <NavigationShell>
              <ManagerOffice />
            </NavigationShell>
          </ProtectedRoute>
        }
      />

      <Route path="/stats" element={<ProtectedRoute><FPLMarket /></ProtectedRoute>} />
      <Route path="/scouting" element={<ProtectedRoute><FPLMarket /></ProtectedRoute>} />
      <Route path="/league-hub" element={<ProtectedRoute><LeagueHub /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><ViewLedger /></ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute><ComingSoon title="Manager Inbox" message="Social features are currently locked." /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />

      <Route path="/card-showcase" element={<CardShowcase />} />
      <Route path="/card-base-demo" element={<CardBaseDemo />} />
      <Route path="/card-test" element={<CardTest />} />
      <Route path="/lab" element={<CardLab />} />
      <Route path="/lab/generic" element={<GenericLab />} />
      <Route path="/debug" element={<APIDebugger />} />

      <Route path="*" element={<Navigate to="/manager-office" replace />} />
    </Routes>
  );
};

function App() {
  useAssetPreloader();
  return (
    <BrowserRouter>
      <GameProvider>
        <Suspense fallback={<LoadingScreen />}>
          <AppRoutes />
        </Suspense>
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;