import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Mail, Eye, EyeOff, UserPlus } from 'lucide-react';

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const navigate = useNavigate();

  const carbonStyle = {
    background: `radial-gradient(circle, #333 1px, transparent 1px), radial-gradient(circle, #333 1px, transparent 1px), #1a1a1a`,
    backgroundSize: '4px 4px',
    backgroundPosition: '0 0, 2px 2px',
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user && !data.session) {
        setNeedsEmailConfirm(true);
        setLoading(false);
        return;
      }
      setTimeout(() => {
        setLoading(false);
        navigate('/dashboard');
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
          <h2 className="text-2xl font-black italic mb-2 tracking-tight uppercase">Verify Access</h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            Activation link sent to <span className="text-white font-bold">{email}</span>.
          </p>
          <Link to="/login" className="text-green-400 hover:text-white font-black text-xs uppercase tracking-widest transition-colors">
            Return to Gate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center relative overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[120px] rounded-full"></div>
      
      <div className="max-w-md w-full mx-auto space-y-8 relative z-10">
        <Link to="/" className="text-gray-500 hover:text-white flex items-center gap-2 mb-4 transition-colors font-black text-[10px] uppercase tracking-[0.2em]">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        <div>
          <h2 className="text-4xl font-black italic mb-2 tracking-tighter uppercase">Join the Club</h2>
          <p className="text-gray-500 text-sm font-medium">Initialize your performance profile.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em] ml-1">Email Terminal</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-green-500/50 transition-all shadow-inner placeholder:text-gray-700"
                placeholder="USER@STADIUM.MOBI"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em] ml-1">Access Cipher</label>
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
          </div>

          {error && (
            <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold uppercase tracking-wider">
              Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full h-[68px] rounded-full p-[2px] transition-all active:scale-95 shadow-[0_0_25px_rgba(34,197,94,0.3)]"
            style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #1a1a1a 100%)' }}
          >
            <div className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-green-400/50" style={carbonStyle}>
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-green-400" /> : (
                <>
                  <UserPlus className="w-5 h-5 text-green-400" />
                  <span className="text-white font-black text-lg tracking-widest italic">CREATE ACCOUNT</span>
                </>
              )}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;