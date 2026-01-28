import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import { Loader2 } from 'lucide-react';

// Components
import NavigationShell from './components/NavigationShell';
import LoadingScreen from './components/LoadingScreen';
import { useAssetPreloader } from './hooks/useAssetPreloader';

// Pages - Eager Loading (Small or frequently accessed)
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import MatchHub from './pages/MatchHub';
import MatchDetail from './pages/MatchDetail';
import Training from './pages/Training';
import LockerRoom from './pages/LockerRoom';
import CardsInPlay from './pages/CardsInPlay';
import Settings from './pages/Settings';
import Account from './pages/Account';
import CardShowcase from './pages/CardShowcase';
import CardBaseDemo from './pages/CardBaseDemo';
import CardTest from './pages/CardTest';
import CardLab from './pages/CardLab';


// Pages - Lazy Loading (Large pages with heavy assets)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ManagerOffice = lazy(() => import('./pages/ManagerOffice'));



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

      {/* DEMO ROUTE - Card System Showcase */}
      <Route path="/card-showcase" element={<CardShowcase />} />
      <Route path="/card-base-demo" element={<CardBaseDemo />} />
      <Route path="/card-test" element={<CardTest />} />
      <Route path="/lab" element={<CardLab />} />


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