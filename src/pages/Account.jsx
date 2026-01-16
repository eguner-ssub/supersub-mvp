import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ArrowLeft, LogOut, User, Mail, Shield, ChevronRight, Backpack } from 'lucide-react';
import MobileLayout from '../components/MobileLayout';

const Account = () => {
  const navigate = useNavigate();
  const { userProfile, supabase } = useGame();

  const handleLogout = async () => {
    try {
      console.log("🛑 SIGNING OUT...");
      // 1. Kill the Supabase session
      await supabase.auth.signOut();

      // 2. Nuke local storage (The "Memory Wipe")
      localStorage.clear();

      // 3. Hard Redirect to login (Safer than navigate for clearing state)
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <MobileLayout>
      <div className="flex flex-col h-full font-sans">

        {/* Header */}
        <div className="p-4 pt-6 flex items-center gap-4 border-b border-gray-800 bg-black/40 backdrop-blur-md">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Manager Profile</h1>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 flex-1 overflow-y-auto">

          {/* Profile Card */}
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center border border-white/10 shadow-xl">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full flex items-center justify-center border-4 border-black/50 shadow-lg mb-4">
              <span className="text-2xl font-black text-black uppercase">
                {userProfile?.name ? userProfile.name.charAt(0) : "M"}
              </span>
            </div>
            <h2 className="text-white text-xl font-black uppercase tracking-wider">
              {userProfile?.name || "Unknown Manager"}
            </h2>
            <p className="text-yellow-500 font-bold text-sm mt-1 uppercase tracking-widest">
              {userProfile?.club_name || "No Club Assigned"}
            </p>
          </div>

          {/* Details Section */}
          <div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 pl-2">Credentials</h3>
            <div className="bg-gray-900/80 rounded-xl border border-white/5 overflow-hidden">

              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300 text-sm font-bold">Email</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">{userProfile?.email}</span>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span className="text-gray-300 text-sm font-bold">Status</span>
                </div>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded uppercase tracking-wider">Active</span>
              </div>

            </div>
          </div>

          {/* My Inventory Button */}
          <button
            onClick={() => navigate('/inventory')}
            className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 border border-yellow-500/30 text-yellow-500 p-4 rounded-xl flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <Backpack className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wide text-sm">My Inventory</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Danger Zone */}
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-center justify-between transition-all group mt-8"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wide text-sm">Sign Out</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-center text-gray-600 text-[10px] mt-8 uppercase tracking-widest">
            Supersub ID: {userProfile?.id?.slice(0, 8) || "UNKNOWN"}
          </p>

        </div>
      </div>
    </MobileLayout>
  );
};

export default Account;