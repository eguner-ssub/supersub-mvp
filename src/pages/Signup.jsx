import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Mail, Eye, EyeOff } from 'lucide-react';

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for toggle
  const [error, setError] = useState(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Check for session
      if (data.user && !data.session) {
        setNeedsEmailConfirm(true);
        setLoading(false);
        return;
      }

      // Success - Redirect
      setTimeout(() => {
        setLoading(false);
        navigate('/dashboard');
      }, 500);

    } catch (err) {
      console.error("Signup Error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen bg-black text-white p-4 flex flex-col justify-center items-center text-center">
        <div className="max-w-md w-full bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
          <Mail className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black italic mb-2">CHECK YOUR INBOX</h2>
          <p className="text-gray-400 mb-6">
            We sent a confirmation link to <span className="text-white">{email}</span>. 
            Click it to activate your account.
          </p>
          <Link to="/login" className="text-yellow-500 hover:text-yellow-400 font-bold text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div>
          <h2 className="text-3xl font-black italic mb-2">JOIN THE CLUB</h2>
          <p className="text-gray-400">Create your account to start betting.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-500 pr-10" // added pr-10 for icon space
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

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl flex items-center justify-center transition-transform active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;