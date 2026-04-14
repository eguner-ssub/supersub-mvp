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
import LaunchPage from './pages/LaunchPage';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import InteractiveOnboarding from './pages/InteractiveOnboarding';
import Inventory from './pages/Inventory';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Pages - Eager Loading (Dashboard must not be lazy — chunk 404 on production)
import Dashboard from './pages/Dashboard';

// Pages - Lazy Loading
const MatchHub = lazy(() => import('./features/match-day/MatchHub'));
const MatchDetail = lazy(() => import('./features/match-day/MatchDetail'));
const Training = lazy(() => import('./pages/Training'));
const LockerRoom = lazy(() => import('./features/locker-room/LockerRoom'));
const CardsInPlay = lazy(() => import('./pages/CardsInPlay'));
const Settings = lazy(() => import('./pages/Settings'));
const Account = lazy(() => import('./pages/Account'));
const CardShowcase = lazy(() => import('./pages/CardShowcase'));
const CardBaseDemo = lazy(() => import('./pages/CardBaseDemo'));
const CardTest = lazy(() => import('./pages/CardTest'));
const CardLab = lazy(() => import('./pages/CardLab'));
const GenericLab = lazy(() => import('./features/inventory/GenericLab'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const FPLMarket = lazy(() => import('./pages/FPLMarket'));
const LeagueHub = lazy(() => import('./features/league-hub/LeagueHub'));
const APIDebugger = lazy(() => import('./features/debug/APIDebugger'));
const ManagerOffice = lazy(() => import('./features/office/ManagerOffice'));
const PublicShareView = lazy(() => import('./pages/PublicShareView'));

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
      {/* PRE-LAUNCH: Remove these routes and restore Landing to / when going live */}
      <Route path="/" element={<LaunchPage />} />
      {/* PRE-LAUNCH: Remove these routes and restore Landing to / when going live */}
      <Route path="/coming-soon" element={<LaunchPage />} />
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
      <Route path="/inventory" element={<Navigate to="/predictions?tab=whiteboard" replace />} />
      <Route path="/inventory/kit-bag" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/energy-drinks" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/predictions" element={<ProtectedRoute><LockerRoom /></ProtectedRoute>} />
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
      <Route path="/history" element={<Navigate to="/predictions?tab=cabinet" replace />} />
      <Route path="/inbox" element={<ProtectedRoute><ComingSoon title="Manager Inbox" message="Social features are currently locked." /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />

      {/* Legal pages — public, no auth required */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Public share view — no auth required */}
      <Route path="/share/:token" element={<PublicShareView />} />

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