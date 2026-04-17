import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // --- DELETE THE USEEFFECT THAT CLEARS SESSION HERE ---
  // We do NOT want to sign out automatically.
  // If the user is redirected here by mistake, we want to keep their session alive.

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);

    console.log("LOGIN_START: ", email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error("Login Error:", error);
        setMessage({ type: 'error', text: error.message });
        setLoading(false);
      } else {
        console.log("Login Success:", data);
        // Switch back to soft navigation. It keeps the 'session' object in memory.
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error("Fatal Crash:", err);
      setMessage({ type: 'error', text: 'Connection failed. Please retry.' });
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Email required.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://supersub.mobi' },
    });
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: 'Magic link sent. Check your email.' });
    setLoading(false);
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Background image */}
      <img
        src="/assets/bg-dressing-room.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Softer gradient — preserves image visibility in upper half */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/30 to-black/90" />

      {/* Scroll container */}
      <div className="relative z-20 h-full w-full overflow-y-auto">
        <div className="min-h-full flex flex-col">

          {/* Back button — top-left, fixed at top */}
          <div className="flex-shrink-0 p-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>

          {/* Logo — sits in the dark zone above the dressing room lights */}
          <div className="flex-shrink-0 flex justify-center pt-4 pb-8">
            <img
              src="/assets/supersub_icon.webp"
              alt="Supersub"
              className="h-32 w-auto opacity-90"
            />
          </div>

          {/* Flex spacer pushes form to lower area */}
          <div className="flex-1 min-h-[5vh]" />

          {/* Form content — sits in middle/lower area */}
          <div className="flex-shrink-0 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="max-w-sm w-full mx-auto">

              {/* Heading — matches app's Signup/Onboarding style */}
              <h1 className="font-black italic text-2xl tracking-tight text-white uppercase mb-8">
                Welcome Back
              </h1>

              {/* Form */}
              <form onSubmit={handlePasswordLogin} className="space-y-4">

                {/* Email */}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                  placeholder="Email"
                  autoComplete="email"
                />

                {/* Password */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                    placeholder="Password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/40 hover:text-white/70 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Message — single line, red for error, green for success */}
                {message && (
                  <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {message.text}
                  </p>
                )}

                {/* Sign In button — flat white */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-semibold py-3.5 rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>

                {/* Magic link — text link, secondary action */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={loading}
                    className="text-white/50 hover:text-white/80 text-sm transition-colors disabled:opacity-50"
                  >
                    Or use a magic link
                  </button>
                </div>

              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
