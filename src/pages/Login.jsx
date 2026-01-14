import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Removed useNavigate since we are using hard reload
import { supabase } from '../supabaseClient';
import { Loader2, ArrowLeft, Mail, Key, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);

  // FORCE CLEANUP ON MOUNT
  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem('supabase.auth.token'); 
      console.log("Session cleared for fresh login attempt.");
    };
    clearSession();
  }, []);

  const carbonStyle = {
    background: `radial-gradient(circle, #333 1px, transparent 1px), radial-gradient(circle, #333 1px, transparent 1px), #1a1a1a`,
    backgroundSize: '4px 4px',
    backgroundPosition: '0 0, 2px 2px',
  };

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
        
        // --- THE FIX: BRUTE FORCE ENTRY ---
        // React Router's navigate() is too fast for Supabase state updates sometimes.
        // This forces a hard browser reload, guaranteeing the App checks the server session again.
        window.location.href = '/dashboard'; 
      }
    } catch (err) {
      console.error("Fatal Crash:", err);
      setMessage({ type: 'error', text: 'Connection failed. Please retry.' });
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Terminal ID required.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://supersub.mobi' },
    });
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: 'Authentication link dispatched.' });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/5 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full mx-auto space-y-8 relative z-10">
        <Link to="/" className="text-gray-500 hover:text-white flex items-center gap-2 mb-4 transition-colors font-black text-[10px] uppercase tracking-[0.2em]">
          <ArrowLeft className="w-3 h-3" /> Gate
        </Link>

        <div>
          <h2 className="text-4xl font-black italic mb-2 tracking-tighter uppercase">Welcome Back</h2>
          <p className="text-gray-500 text-sm font-medium">Resume match intelligence operations.</p>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em] ml-1">Terminal ID</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-yellow-500/40 transition-all placeholder:text-gray-700"
                placeholder="USER@STADIUM.MOBI"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-[0.2em] ml-1">Security Key</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-yellow-500/40 transition-all pr-12 placeholder:text-gray-700"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 text-gray-600 hover:text-white">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-wider border ${message.type === 'error' ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-green-500/5 border-green-500/20 text-green-400'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full h-[64px] rounded-full p-[2px] transition-all active:scale-95 shadow-[0_0_20px_rgba(245,197,70,0.2)] overflow-hidden"
              style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #1a1a1a 100%)' }}
            >
              <div 
                className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-yellow-500/30 relative z-10" 
                style={carbonStyle}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                ) : (
                  <>
                    <Key className="w-4 h-4 text-yellow-500" />
                    <span className="text-white font-black text-lg tracking-widest italic uppercase">Access Profile</span>
                  </>
                )}
              </div>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-gray-700 text-[10px] font-black tracking-widest">AUXILIARY</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="group relative w-full h-[60px] rounded-full p-[2px] transition-all active:scale-95"
              style={{ background: 'linear-gradient(180deg, #444 0%, #111 100%)' }}
            >
              <div className="w-full h-full rounded-full flex items-center justify-center gap-3 border-[1px] border-white/5" style={carbonStyle}>
                <Mail className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                <span className="text-gray-500 group-hover:text-white font-black text-xs tracking-widest italic uppercase transition-colors">Dispatch Magic Link</span>
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;