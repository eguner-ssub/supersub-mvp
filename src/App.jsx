import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import { Loader2 } from 'lucide-react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MatchHub from './pages/MatchHub';
import MatchDetail from './pages/MatchDetail';
import Training from './pages/Training';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings'; 

// --- THE BOUNCER (Security Guard) ---
const ProtectedRoute = ({ children }) => {
  const { userProfile, loading } = useGame();

  // 1. If we don't know who they are yet, wait.
  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  // 2. If they are NOT logged in, kick them to Login.
  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  // 3. Otherwise, let them in.
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* PUBLIC ROUTE: Anyone can visit Login */}
      <Route path="/login" element={<Login />} />

      {/* PROTECTED ROUTES: Must be logged in */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/match-hub" element={<ProtectedRoute><MatchHub /></ProtectedRoute>} />
      <Route path="/match/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      {/* Fallback: Send lost users to dashboard (which will redirect to Login if needed) */}
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