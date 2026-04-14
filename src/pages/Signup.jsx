import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Mail, Eye, EyeOff, UserPlus } from 'lucide-react';
import { trackFunnelEvent } from '../shared/utils/trackFunnelEvent';

const COUNTRIES = [
  { code: 'GB', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'England' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany' },
  { code: 'ES', flag: '🇪🇸', label: 'Spain' },
  { code: 'IT', flag: '🇮🇹', label: 'Italy' },
  { code: 'BR', flag: '🇧🇷', label: 'Brazil' },
  { code: 'FR', flag: '🇫🇷', label: 'France' },
  { code: 'AR', flag: '🇦🇷', label: 'Argentina' },
  { code: 'NL', flag: '🇳🇱', label: 'Netherlands' },
  { code: 'PT', flag: '🇵🇹', label: 'Portugal' },
  { code: 'TR', flag: '🇹🇷', label: 'Turkey' },
  { code: 'NG', flag: '🇳🇬', label: 'Nigeria' },
  { code: 'GH', flag: '🇬🇭', label: 'Ghana' },
  { code: 'US', flag: '🇺🇸', label: 'United States' },
  { code: 'MX', flag: '🇲🇽', label: 'Mexico' },
  { code: 'CO', flag: '🇨🇴', label: 'Colombia' },
  { code: 'ZA', flag: '🇿🇦', label: 'South Africa' },
  { code: 'EG', flag: '🇪🇬', label: 'Egypt' },
  { code: 'MA', flag: '🇲🇦', label: 'Morocco' },
  { code: 'JP', flag: '🇯🇵', label: 'Japan' },
  { code: 'KR', flag: '🇰🇷', label: 'South Korea' },
  { code: 'OTHER', flag: '🌍', label: 'Other' },
];

const FEATURES = [
  { icon: '⚡', text: 'Play free — no real money' },
  { icon: '🏆', text: 'Earn points. Beat your rivals.' },
  { icon: '🌍', text: 'Compete globally' },
];

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [complianceError, setComplianceError] = useState(null);
  const [error, setError] = useState(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const navigate = useNavigate();

  // F-004: signup page view (fires on mount, before auth)
  useEffect(() => { trackFunnelEvent('signup_page_viewed'); }, []);

  const carbonStyle = {
    background: `radial-gradient(circle, #333 1px, transparent 1px), radial-gradient(circle, #333 1px, transparent 1px), #1a1a1a`,
    backgroundSize: '4px 4px',
    backgroundPosition: '0 0, 2px 2px',
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setComplianceError(null);

    // Guard: both compliance boxes must be checked
    if (!isAgeVerified || !hasAcceptedTerms) {
      setComplianceError('Please confirm your age and accept the Terms of Service to continue.');
      return;
    }

    setLoading(true);

    try {
      trackFunnelEvent('signup_submitted');
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user && !data.session) {
        setNeedsEmailConfirm(true);
        setLoading(false);
        return;
      }

      // Write compliance + funnel fields to profiles.
      // The profile row is created by a Supabase trigger on auth.users insert.
      // Use upsert so this is safe even if the trigger hasn't fired yet.
      await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          terms_accepted_at: new Date().toISOString(),
          is_age_verified: true,
          country_code: countryCode || null,
          referral_code: referralCode.trim() || null,
        }, { onConflict: 'id' });

      trackFunnelEvent('signup_completed', { country_code: countryCode || null }, data.user.id);

      // SUCCESS: Navigate to Onboarding, NOT Dashboard.
      // The GameContext listener will detect the new session automatically.
      setTimeout(() => {
        setLoading(false);
        navigate('/onboarding');
      }, 500);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center items-center text-center">
        <div className="max-w-md w-full bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl" style={carbonStyle}>
          <Mail className="w-16 h-16 text-green-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]" />
          <h2 className="text-2xl font-black italic mb-2 tracking-tight uppercase">Check Your Inbox</h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            We've sent a link to <span className="text-white font-bold">{email}</span> to get you started.
          </p>
          <Link to="/login" className="text-green-400 hover:text-white font-black text-xs uppercase tracking-widest transition-colors">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6 flex flex-col justify-center relative overflow-hidden bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/assets/bg-clubroom.webp')" }}
      />
      <div className="fixed inset-0 bg-black/50 z-0" />

      <div className="max-w-md w-full mx-auto space-y-8 relative z-10">
        <Link to="/" className="text-gray-500 hover:text-white flex items-center gap-2 mb-4 transition-colors font-black text-[10px] uppercase tracking-[0.2em]">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        {/* Feature rows */}
        <div className="flex flex-col gap-2">
          {FEATURES.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-white/60">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div>
          <h2 className="font-black italic text-4xl tracking-widest text-white uppercase mb-2">Join the Club</h2>
          <p className="text-gray-500 text-sm font-medium">Call the sub before the manager does.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-green-500/50 transition-all shadow-inner placeholder:text-gray-700"
                placeholder="USER@STADIUM.MOBI"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-green-500/50 transition-all pr-12 shadow-inner placeholder:text-gray-700"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-600 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Country picker */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Your Country</label>
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white appearance-none focus:outline-none focus:border-green-500/50 transition-all shadow-inner"
              >
                <option value="">Select your country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Referral code (collapsed) */}
            <div>
              <button
                type="button"
                onClick={() => setShowReferral(v => !v)}
                className="text-[10px] text-white/25 hover:text-white/45 transition-colors uppercase tracking-widest"
              >
                {showReferral ? '▾' : '▸'} Have a referral code?
              </button>
              {showReferral && (
                <input
                  type="text"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                  placeholder="Enter code"
                  className="mt-2 w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white placeholder:text-gray-700 focus:outline-none focus:border-green-500/50 transition-all shadow-inner"
                />
              )}
            </div>
          </div>

          {/* ── Compliance checkboxes ──────────────────────────────────────── */}
          <div className="space-y-3 pt-1">
            {/* Checkbox 1 — Age confirmation */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isAgeVerified}
                  onChange={e => setIsAgeVerified(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border transition-all ${
                    isAgeVerified
                      ? 'bg-green-500 border-green-500'
                      : 'bg-[#0f0f0f] border-white/20 group-hover:border-white/40'
                  } flex items-center justify-center`}
                >
                  {isAgeVerified && (
                    <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                I confirm I am 18 years of age or older
              </span>
            </label>

            {/* Checkbox 2 — Terms acceptance */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={hasAcceptedTerms}
                  onChange={e => setHasAcceptedTerms(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border transition-all ${
                    hasAcceptedTerms
                      ? 'bg-green-500 border-green-500'
                      : 'bg-[#0f0f0f] border-white/20 group-hover:border-white/40'
                  } flex items-center justify-center`}
                >
                  {hasAcceptedTerms && (
                    <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                I agree to the{' '}
                <Link
                  to="/terms"
                  onClick={e => e.stopPropagation()}
                  className="text-green-400 underline underline-offset-2 hover:text-green-300 transition-colors"
                >
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link
                  to="/privacy"
                  onClick={e => e.stopPropagation()}
                  className="text-green-400 underline underline-offset-2 hover:text-green-300 transition-colors"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>

            {/* Compliance error */}
            {complianceError && (
              <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold uppercase tracking-wider">
                {complianceError}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold uppercase tracking-wider">
              Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full h-[68px] rounded-full p-[2px] transition-all active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
            style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #1a1a1a 100%)' }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-green-400/50"
              style={carbonStyle}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-green-400" /> : (
                <>
                  <UserPlus className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="text-white font-black text-xl tracking-widest italic">CREATE ACCOUNT</span>
                </>
              )}
            </div>
          </button>

          {/* Footer links */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/terms"
              className="text-[9px] text-white/25 uppercase tracking-widest hover:text-white/45 transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-white/15 text-[9px]">·</span>
            <Link
              to="/privacy"
              className="text-[9px] text-white/25 uppercase tracking-widest hover:text-white/45 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
