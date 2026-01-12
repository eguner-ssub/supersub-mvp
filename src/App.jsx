import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext';
import MobileLayout from './components/MobileLayout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import MatchHub from './pages/MatchHub';
import MatchDetail from './pages/MatchDetail';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';

const AppRoutes = () => {
  const { isNewUser, isLoading } = useGame();

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-gray-700">
          <p className="text-center text-gray-400">Loading...</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isNewUser ? <Onboarding /> : <Navigate to="/dashboard" replace />}
      />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/training" element={<Training />} />
      <Route path="/match-hub" element={<MatchHub />} />
      
      {/* 🔴 FIXED: Changed :matchId to :id to match your component code */}
      <Route path="/match/:id" element={<MatchDetail />} />
      
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <GameProvider>
        <AppRoutes />
      </GameProvider>
    </Router>
  );
}

export default App;