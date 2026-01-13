import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, LogOut, User, Mail, Shield, ChevronRight } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Settings = () => {
  const navigate = useNavigate();
  const { userProfile, supabase } = useGame();

  const handleLogout = async () => {
    try {
      // 1. Tell Supabase to kill the session
      await supabase.auth.signOut();
      // 2. The GameContext listener will detect this automatically
      // 3. App.jsx will see userProfile is null and kick you to /login
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <MobileLayout>
      <div className="flex flex-col h-full bg-black text-white font-sans">
        
        {/* Header */}
        <div className="p-4 pt-6 flex items-center gap-4 border-b border-gray-800 bg-gray-900">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4 border border-gray-700">
            <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border border-gray-600">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm text-gray-400 uppercase tracking-wider font-bold">Manager Profile</p>
              <p className="text-white font-semibold truncate">{userProfile?.email || "Unknown"}</p>
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h2 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2 pl-2">Account</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <span className="text-xs text-gray-500">{userProfile?.email}</span>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Active</span>
              </div>

            </div>
          </div>

          {/* Danger Zone */}
          <button 
            onClick={handleLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-center justify-between transition-all group mt-8"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Log Out</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-center text-gray-600 text-xs mt-4">
            Supersub v1.0.0 (MVP)
          </p>

        </div>
      </div>
    </MobileLayout>
  );
};

export default Settings;