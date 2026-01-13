import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft } from 'lucide-react';

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // If email confirmation is OFF in Supabase, they are logged in.
      // If ON, you should show a "Check your email" message here.
      // We assume it's OFF for this MVP flow.
      navigate('/dashboard'); 
    }
  };

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
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;