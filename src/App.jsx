import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './shared/context/GameContext';
import { Loader2 } from 'lucide-react';

// Components
import NavigationShell from './shared/ui/NavigationShell';
import LoadingScreen from './components/LoadingScreen';
import { useAssetPreloader } from './hooks/useAssetPreloader';

// Pages - Eager Loading (Small or frequently accessed)
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
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
import APIDebugger from './features/debug/APIDebugger';


// Pages - Lazy Loading (Large pages with heavy assets)
const Dashboard = lazy(() => import('./pages/Dashboard'));
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

// 1. EXPORT THIS SEPARATELY SO TESTS CAN USE IT
export const AppRoutes = () => {
  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* ONBOARDING */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* DASHBOARD & GAME - WRAPPED IN NAVIGATION SHELL */}
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

      {/* --- 2. ACCOUNT ROUTE ADDED HERE --- */}
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />

      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/match-hub" element={<ProtectedRoute><MatchHub /></ProtectedRoute>} />
      <Route path="/match/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><LockerRoom /></ProtectedRoute>} />
      <Route path="/inventory/active" element={<ProtectedRoute><CardsInPlay /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* MANAGER OFFICE - WRAPPED IN NAVIGATION SHELL */}
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

      {/* --- NEW ROUTES FOR MANAGER OFFICE --- */}

      {/* 1. STATS (Laptop) */}
      <Route
        path="/stats"
        element={<ProtectedRoute><ComingSoon title="Season Stats" message="Advanced player analytics coming in v1.1" /></ProtectedRoute>}
      />

      {/* 2. INBOX (Phone) */}
      <Route
        path="/inbox"
        element={<ProtectedRoute><ComingSoon title="Manager Inbox" message="Social features are currently locked." /></ProtectedRoute>}
      />

      {/* 3. LEADERBOARD (Tablet) */}
      <Route
        path="/leaderboard"
        element={<ProtectedRoute><ComingSoon title="Global Rankings" message="Competition season hasn't started yet." /></ProtectedRoute>}
      />

      <Route path="/card-showcase" element={<CardShowcase />} />
      <Route path="/card-base-demo" element={<CardBaseDemo />} />
      <Route path="/card-test" element={<CardTest />} />
      <Route path="/lab" element={<CardLab />} />
      <Route path="/lab/generic" element={<GenericLab />} />

      {/* DEBUG ROUTE - API Inspector */}
      <Route path="/debug" element={<APIDebugger />} />


      {/* Fallback logic - Default to Manager Office */}
      <Route path="*" element={<Navigate to="/manager-office" replace />} />
    </Routes>
  );
};

function App() {
  // Trigger aggressive asset preloading
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