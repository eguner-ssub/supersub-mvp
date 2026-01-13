import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Loader2, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Supabase Magic Link Logic
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // IMPORTANT: This URL must be allowed in your Supabase Auth settings
        emailRedirectTo: window.location.origin, 
      },
    });

    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl border border-gray-700">
           <Mail className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
           <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
           <p className="text-gray-400">We sent a magic link to <span className="text-white font-mono">{email}</span>.</p>
           <p className="text-gray-500 text-sm mt-4">Click the link in the email to sign in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/bg-stadium.png')] bg-cover opacity-20 z-0"></div>
      
      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white italic tracking-tighter">SUPERSUB</h1>
          <p className="text-yellow-500 font-bold tracking-widest text-xs uppercase mt-1">Manager Access</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/50 border border-gray-600 rounded-xl p-4 text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition-colors mb-6"
            placeholder="pep@city.com"
          />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : <>ENTER DUGOUT <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;