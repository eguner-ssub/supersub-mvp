import React, { useState } from 'react';
import { Zap, Star, User, Mail, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useGame } from '../context/GameContext';

/**
 * GameHeader — common top HUD for all in-app pages.
 * Renders as absolute so it floats over its relative-positioned parent.
 * Includes the settings bottom sheet triggered by tapping the club name.
 */
export default function GameHeader() {
  const { userProfile, supabase } = useGame();
  const [showSettings, setShowSettings] = useState(false);

  const energy   = userProfile?.energy    ?? 0;
  const maxEnergy = userProfile?.max_energy ?? 5;
  const points   = userProfile?.points    ?? 0;
  const clubName = userProfile?.club_name || userProfile?.name || 'Manager';

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); }
    catch (e) { console.error('Logout error:', e); }
  };

  return (
    <>
      {/* ── HUD bar ── */}
      <div className="absolute top-0 left-0 w-full px-4 pt-6 pb-2 flex justify-between items-center z-50 pointer-events-none">

        {/* Energy pill */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-xs font-mono">{energy}/{maxEnergy}</span>
        </div>

        {/* Club name — tappable, opens settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute left-1/2 -translate-x-1/2 pointer-events-auto text-white text-sm font-black uppercase tracking-widest drop-shadow-lg truncate max-w-[150px] text-center active:opacity-70 transition-opacity"
        >
          {clubName}
        </button>

        {/* Points pill */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-xs font-mono">{points}</span>
        </div>
      </div>

      {/* ── Settings bottom sheet ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full bg-zinc-900 rounded-t-2xl border-t border-white/10 p-6 pb-10 animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

            {/* Profile card */}
            <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-4 border border-white/10 mb-6">
              <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center border border-white/10 flex-shrink-0">
                <User className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">Manager Profile</p>
                <p className="text-white font-semibold truncate text-sm">{userProfile?.email || 'Unknown'}</p>
              </div>
            </div>

            {/* Account info */}
            <div className="bg-zinc-800/60 rounded-xl border border-white/10 overflow-hidden mb-6">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">Email</span>
                </div>
                <span className="text-xs text-zinc-500 truncate max-w-[160px]">{userProfile?.email}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">Status</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">Active</span>
              </div>
            </div>

            {/* Log out */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 active:scale-95 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <span className="font-bold">Log Out</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-50 group-active:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
