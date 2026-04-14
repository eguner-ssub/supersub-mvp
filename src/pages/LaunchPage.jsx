import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

// Simple RFC 5322–ish check. Good enough for a signup gate; server enforces UNIQUE.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LaunchPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ email: trimmed });

      // Treat duplicates (unique_violation = '23505') as success — they're already on the list.
      if (error && error.code !== '23505') {
        throw error;
      }

      setStatus('success');
    } catch (err) {
      console.error('[waitlist] insert failed:', err);
      setStatus('idle');
      setErrorMsg('Something went wrong. Try again.');
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden relative">
      {/* Background */}
      <img
        src="/assets/bg-tunnel-live.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full px-6 py-12">

        {/* Top: logo + copy */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <img src="/logo.webp" alt="Supersub" className="w-48 h-auto mb-6" />
          <p className="text-white text-base font-medium text-center">
            The prediction game for the substitution moment.
          </p>
          <p className="text-[#00E5FF] font-bold text-sm text-center mt-2">
            Launching 16 April 2026
          </p>
        </div>

        {/* Middle: email form or success state */}
        <div className="w-full max-w-sm">
          {status === 'success' ? (
            <p className="text-white text-center font-bold">
              You're on the list. See you Thursday.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm outline-none focus:border-[#00E5FF]"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-[#00E5FF] text-black font-black uppercase tracking-widest rounded-xl py-3 text-sm active:scale-95 transition-all disabled:opacity-60"
              >
                {status === 'loading' ? '...' : 'NOTIFY ME'}
              </button>
              {errorMsg && (
                <p className="text-red-400 text-sm text-center">{errorMsg}</p>
              )}
            </form>
          )}
        </div>

        {/* Bottom: legal line */}
        <p className="text-white/40 text-[11px] text-center">
          Free to play. No deposits. No bets.
        </p>
      </div>
    </div>
  );
};

export default LaunchPage;
