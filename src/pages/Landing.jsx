import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, LogIn, UserPlus } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="bg-gradient-to-tr from-yellow-400 to-yellow-600 p-4 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.3)] mb-6">
            <Trophy className="w-12 h-12 text-black" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">
            SUPER<span className="text-yellow-500">SUB</span>
          </h1>
          <p className="text-gray-400 text-lg">Predict. Outsmart. Win.</p>
        </div>

        {/* Actions */}
        <div className="space-y-4 pt-8">
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            LOGIN
          </button>

          <button
            onClick={() => navigate('/signup')}
            className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <UserPlus className="w-5 h-5 text-gray-400" />
            CREATE ACCOUNT
          </button>
        </div>

      </div>
    </div>
  );
};

export default Landing;