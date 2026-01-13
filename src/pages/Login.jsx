import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Mail, Key, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Option 1: Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      // SUCCESS: Send to Dashboard. The App.jsx 'Bouncer' will check if they need Onboarding.
      navigate('/dashboard');
    }
  };

  // Option 2: Magic Link Login
  const handleMagicLink = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email first.' });
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://supersub.mobi' },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Magic link sent! Check your email.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div>
          <h2 className="text-3xl font-black italic mb-2">WELCOME BACK</h2>
          <p className="text-gray-400">Login to access your dashboard.</p>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-500 mb-1">PASSWORD</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} // Dynamic type
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-500 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {message.text}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Key className="w-4 h-4" /> LOGIN WITH PASSWORD</>}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-xs">OR</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" /> SEND MAGIC LINK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;