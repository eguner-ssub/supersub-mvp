import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useGame } from '../context/GameContext';

/**
 * ShareCardButton
 *
 * Compact share button for predictions. Uses native share sheet on mobile,
 * falls back to clipboard copy on desktop.
 *
 * Props:
 *   prediction — prediction row (must include share_token)
 *   variant    — 'pre' | 'won' | 'lost'
 *   className  — optional extra classes
 */
const ShareCardButton = ({ prediction, variant = 'pre', className = '' }) => {
  const { userProfile, supabase } = useGame();
  const [copied, setCopied] = useState(false);

  if (!prediction?.share_token) return null;

  const shareUrl = `https://supersub.mobi/share/${prediction.share_token}`;

  // Build match name from available fields
  const matchName = prediction.match_title || prediction.team_name || '';

  // Build share copy based on variant
  const buildCopy = () => {
    const sel = prediction.selection_label || prediction.selection || 'my call';
    switch (variant) {
      case 'won':
        return `I called it. ${sel} — +${prediction.points_awarded ?? 0} pts on Supersub 🏆 ${shareUrl}`;
      case 'lost':
        return `So close. ${sel} — back your next call at supersub.mobi`;
      case 'pre':
      default: {
        const matchPart = matchName ? ` — ${matchName}` : '';
        return `I'm calling ${sel}${matchPart}. Can you call it? Play free at supersub.mobi 🎯`;
      }
    }
  };

  const handleShare = async () => {
    const copyText = buildCopy();

    // Fire-and-forget tracking (ignore errors — CHECK constraint may not include 'share')
    void supabase?.from('affiliate_events').insert({
      user_id:   userProfile?.id ?? null,
      event_type: 'share',
      operator:  'bet365',
      card_type: prediction.card_type ?? null,
      match_id:  prediction.match_id ?? null,
      odds:      prediction.odds ?? null,
    }).then(() => {}).catch(() => {});

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Supersub', text: copyText, url: shareUrl });
      } catch (e) {
        // User cancelled share sheet — not an error
        if (e.name !== 'AbortError') console.warn('Share failed:', e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.warn('Clipboard copy failed');
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 transition-colors ${className}`}
      style={{ minHeight: '36px', padding: '6px 14px' }}
    >
      <Share2 className="w-3.5 h-3.5" />
      <span className="text-[10px] font-black uppercase tracking-widest">
        {copied ? 'Copied!' : 'Share'}
      </span>
    </button>
  );
};

export default ShareCardButton;
