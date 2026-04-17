import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'stats_gen_password';

export default function StatsGen() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(STORAGE_KEY) || null);
  const [authError, setAuthError] = useState(null);
  const [viewportOk, setViewportOk] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setViewportOk(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const input = e.target.elements.password.value;
    setAuthError(null);

    try {
      const res = await fetch('/api/stats-gen/matches', {
        headers: { 'x-stats-gen-password': input }
      });

      if (res.ok) {
        sessionStorage.setItem(STORAGE_KEY, input);
        setPassword(input);
      } else if (res.status === 401) {
        setAuthError('Wrong password');
      } else {
        setAuthError('Unexpected error');
      }
    } catch (err) {
      setAuthError('Network error');
    }
  };

  // Mobile placeholder
  if (!viewportOk) {
    return (
      <div className="h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-2">
            Desktop Only
          </p>
          <p className="text-zinc-600 text-xs">
            Stats-gen is not available on mobile or narrow viewports.
          </p>
        </div>
      </div>
    );
  }

  // Password gate
  if (!password) {
    return (
      <div className="h-screen w-full bg-[#0a0a0f] flex items-center justify-center p-8">
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs">
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-4 text-center">
            Stats Gen · Password Required
          </p>
          <input
            type="password"
            name="password"
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500"
            placeholder="Password"
          />
          <button
            type="submit"
            className="w-full mt-3 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest text-xs rounded-lg transition-colors"
          >
            Enter
          </button>
          {authError && (
            <p className="text-red-400 text-xs text-center mt-3">{authError}</p>
          )}
        </form>
      </div>
    );
  }

  // Main layout — two columns
  return (
    <div className="h-screen w-full bg-[#0a0a0f] flex overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-[320px] flex-shrink-0 border-r border-zinc-900 overflow-y-auto p-6">
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">
          Stats Gen
        </p>
        {/* Controls wired in next prompt */}
      </aside>

      {/* Right preview panel */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[960px] mx-auto p-6">
          {/* Empty state */}
          <div className="h-[80vh] flex items-center justify-center">
            <p className="text-zinc-600 text-sm">
              Select a content type and load data to preview.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
