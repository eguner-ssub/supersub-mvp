import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import { Loader2 } from 'lucide-react';

// Pages
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MatchHub from './pages/MatchHub';
import MatchDetail from './pages/MatchDetail';
import Training from './pages/Training';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings'; 

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
      <Route path="/" element={<Landing />} />
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

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/match-hub" element={<ProtectedRoute><MatchHub /></ProtectedRoute>} />
      <Route path="/match/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <AppRoutes />
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;