import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, Trophy, Clock, X as XIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import AffiliateDisclaimer from '../shared/ui/AffiliateDisclaimer';

// Card type display config — mirrors share-card.js and cardConfig.js
const CARD_CONFIG = {
  c_supersub:      { label: 'SUPERSUB CARD',    color: '#00E5FF' },
  c_match_result:  { label: 'MATCH RESULT',     color: '#00D4A0' },
  c_total_goals:   { label: 'TOTAL GOALS',      color: '#FFB800' },
  c_player_score:  { label: 'GOALSCORER',       color: '#FF4D6A' },
};

const PublicShareView = () => {
  const { token } = useParams();
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPrediction = async () => {
      // Use anon key — this is a public page, no auth required
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY
      );

      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('share_token', token)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPrediction(data);

        // Update OG meta tags for crawlers
        const ogImageUrl = `https://supersub.mobi/api/share-card?token=${token}`;
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', ogImageUrl);
        document.querySelector('meta[property="og:title"]')?.setAttribute('content',
          `${data.selection_label || data.selection || 'Prediction'} — Supersub`);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', ogImageUrl);
        document.querySelector('meta[name="twitter:title"]')?.setAttribute('content',
          `${data.selection_label || data.selection || 'Prediction'} — Supersub`);
      }

      setLoading(false);
    };

    if (token) fetchPrediction();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
          <XIcon className="w-8 h-8 text-zinc-500" />
        </div>
        <h1 className="text-white font-black text-2xl uppercase tracking-tight mb-2">
          Prediction not found
        </h1>
        <p className="text-zinc-500 text-sm mb-8">
          This prediction has expired or doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-block px-8 py-4 bg-cyan-500 text-black font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-cyan-400 transition-colors"
        >
          Go to Supersub →
        </Link>
      </div>
    );
  }

  const navigate = useNavigate();
  const status = prediction.settled_status || prediction.status || 'PENDING';
  const isWon = status === 'WON';
  const isLost = status === 'LOST';
  const isPending = prediction.status === 'PENDING' || prediction.status === 'LIVE';
  const matchId = prediction.match_id;
  const cardConf = CARD_CONFIG[prediction.card_type] || CARD_CONFIG.c_supersub;
  const selectionLabel = prediction.selection_label || prediction.selection || 'Prediction';
  const matchName = prediction.match_title || prediction.team_name || '';
  const points = prediction.points_awarded ?? prediction.potential_reward ?? 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-5 py-10">

      {/* Card */}
      <div className="w-full max-w-sm bg-zinc-900/80 border border-white/10 rounded-3xl p-7 relative overflow-hidden">

        {/* Top accent */}
        <div
          className="absolute top-0 left-0 w-full h-1 rounded-t-3xl"
          style={{ background: isWon ? '#00D4A0' : isLost ? '#666' : '#00E5FF' }}
        />

        {/* Brand */}
        <div className="flex items-baseline gap-1 mb-6">
          <span className="text-white font-black text-lg tracking-tight">SUPERSUB</span>
          <span className="text-cyan-400 font-bold text-xs">.mobi</span>
        </div>

        {/* Card type badge */}
        <div
          className="inline-flex items-center rounded-lg px-3 py-1 mb-4"
          style={{
            background: `${cardConf.color}15`,
            border: `1.5px solid ${cardConf.color}40`,
          }}
        >
          <span
            className="text-[10px] font-black uppercase tracking-[2px]"
            style={{ color: cardConf.color }}
          >
            {cardConf.label}
          </span>
        </div>

        {/* Selection */}
        <h2 className={`font-black text-2xl tracking-tight leading-tight mb-2 ${isLost ? 'text-zinc-500' : 'text-white'}`}>
          {selectionLabel}
        </h2>

        {/* Match name */}
        {matchName && (
          <p className="text-zinc-500 text-sm mb-5">{matchName}</p>
        )}

        {/* Status badge */}
        {isWon && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 mb-2">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-emerald-400 font-black text-sm uppercase tracking-wider">Called it</p>
              {points > 0 && (
                <p className="text-emerald-300 font-black text-xl">+{points} pts</p>
              )}
            </div>
          </div>
        )}

        {isLost && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-2">
            <p className="text-zinc-500 font-bold text-sm">Unlucky</p>
          </div>
        )}

        {!isWon && !isLost && (
          <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl px-4 py-3 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <p className="text-cyan-400 font-bold text-sm">Awaiting result</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mt-6 space-y-3">
        {isPending && matchId && (
          <button
            onClick={() => navigate(`/match/${matchId}`)}
            className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl"
          >
            Make your own call →
          </button>
        )}

        {isWon && (
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl"
          >
            Play free at supersub.mobi →
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-8">
        <AffiliateDisclaimer />
      </div>
    </div>
  );
};

export default PublicShareView;
