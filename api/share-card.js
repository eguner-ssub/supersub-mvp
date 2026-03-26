import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

// Card type display config — accent colors match cardConfig.js
const CARD_CONFIG = {
  c_supersub:      { label: 'SUPERSUB CARD',    color: '#00E5FF' },
  c_match_result:  { label: 'MATCH RESULT',     color: '#00D4A0' },
  c_total_goals:   { label: 'TOTAL GOALS',      color: '#FFB800' },
  c_player_score:  { label: 'GOALSCORER',       color: '#FF4D6A' },
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return new Response('Invalid token format', { status: 400 });
  }

  // Lazy Supabase init (inside handler, not top-level)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: prediction, error } = await supabase
    .from('predictions')
    .select('*, matches(id, home_team, away_team)')
    .eq('share_token', token)
    .single();

  // If prediction not found, return a fallback brand image
  if (error || !prediction) {
    return new ImageResponse(
      fallbackImage(),
      { width: 1200, height: 630, headers: cacheHeaders(3600) }
    );
  }

  // Derive display values
  const matchName = prediction.match_title
    || prediction.team_name
    || (prediction.matches ? `${prediction.matches.home_team} vs ${prediction.matches.away_team}` : 'Match');
  const selectionLabel = prediction.selection_label || prediction.selection || 'Prediction';
  const cardConf = CARD_CONFIG[prediction.card_type] || CARD_CONFIG.c_supersub;
  const status = prediction.settled_status || prediction.status || 'PENDING';
  const points = prediction.points_awarded ?? prediction.potential_reward ?? 0;

  // Determine variant
  const isWon = status === 'WON';
  const isLost = status === 'LOST';
  const isPre = !isWon && !isLost;

  // Cache: short for unsettled, long for settled
  const maxAge = isPre ? 60 : 3600;

  return new ImageResponse(
    cardImage({ matchName, selectionLabel, cardConf, isWon, isLost, isPre, points }),
    { width: 1200, height: 630, headers: cacheHeaders(maxAge) }
  );
}

function cacheHeaders(maxAge) {
  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
  };
}

function fallbackImage() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0A0A0F', fontFamily: 'sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '20px' }}>
        <span style={{ fontSize: '72px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-2px' }}>SUPERSUB</span>
        <span style={{ fontSize: '32px', fontWeight: 700, color: '#00E5FF', marginLeft: '8px' }}>.mobi</span>
      </div>
      <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
        Call the sub before the manager does
      </p>
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: '#00E5FF' }} />
    </div>
  );
}

function cardImage({ matchName, selectionLabel, cardConf, isWon, isLost, isPre, points }) {
  const accentColor = isWon ? '#00D4A0' : isLost ? '#666666' : '#00E5FF';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '50px 60px',
      background: '#0A0A0F', fontFamily: 'sans-serif', position: 'relative',
    }}>
      {/* Top row: branding + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1px' }}>SUPERSUB</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#00E5FF', marginLeft: '6px' }}>.mobi</span>
        </div>

        {isWon && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(0,212,160,0.15)', border: '2px solid #00D4A0',
            borderRadius: '12px', padding: '8px 20px',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#00D4A0' }}>✓ CALLED IT</span>
          </div>
        )}

        {isPre && (
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(0,229,255,0.1)', border: '2px solid rgba(0,229,255,0.3)',
            borderRadius: '12px', padding: '8px 20px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '2px' }}>
              I'm calling this
            </span>
          </div>
        )}

        {isLost && (
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '8px 20px',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#666' }}>✗</span>
          </div>
        )}
      </div>

      {/* Centre content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* Card type badge */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: `${cardConf.color}15`, border: `2px solid ${cardConf.color}40`,
          borderRadius: '8px', padding: '6px 16px', marginBottom: '20px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: cardConf.color, textTransform: 'uppercase', letterSpacing: '3px' }}>
            {cardConf.label}
          </span>
        </div>

        {/* Selection label */}
        <span style={{
          fontSize: '52px', fontWeight: 900, color: isLost ? '#888' : '#FFFFFF',
          letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '16px',
        }}>
          {selectionLabel}
        </span>

        {/* Match name */}
        <span style={{ fontSize: '22px', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
          {matchName}
        </span>

        {/* Points for WON */}
        {isWon && points > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', marginTop: '20px',
            background: 'rgba(0,212,160,0.1)', borderRadius: '12px', padding: '10px 24px',
          }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#00D4A0' }}>+{points} pts</span>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>
          Play free at supersub.mobi
        </span>
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px',
        background: accentColor,
      }} />
    </div>
  );
}
