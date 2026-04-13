import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

// Node.js serverless runtime (default) — compatible with @supabase/supabase-js
// Edge runtime does NOT support supabase-js, so we intentionally omit:
//   export const config = { runtime: 'edge' };

// Card type display config — accent colors match cardConfig.js
const CARD_CONFIG = {
  c_supersub:      { label: 'SUPERSUB CARD',    color: '#00E5FF' },
  c_match_result:  { label: 'MATCH RESULT',     color: '#00D4A0' },
  c_total_goals:   { label: 'TOTAL GOALS',      color: '#FFB800' },
  c_player_score:  { label: 'GOALSCORER',       color: '#FF4D6A' },
};

const CARD_BASE_URLS = {
  c_match_result: 'https://supersub.mobi/assets/matchresult_cardbase.webp',
  c_total_goals:  'https://supersub.mobi/assets/totalgoals_cardbase.webp',
  c_player_score: 'https://supersub.mobi/assets/playerscore_cardbase.webp',
  c_supersub:     'https://supersub.mobi/assets/supersub_cardbase.webp',
};

const ICON_URLS = {
  c_match_result: 'https://supersub.mobi/assets/stadium_icon.webp',
  c_total_goals:  'https://supersub.mobi/assets/goal_icon.webp',
  c_player_score: 'https://supersub.mobi/assets/player_icon.webp',
  c_supersub:     'https://supersub.mobi/assets/supersub_icon.webp',
};

const FOOTER_COLORS = {
  c_match_result: '#7C3AED',
  c_total_goals:  '#059669',
  c_player_score: '#D97706',
  c_supersub:     '#475569',
};

export default async function handler(req, res) {
  // req.url in Node.js serverless is just the path+query, so supply a base
  const { searchParams } = new URL(req.url, 'http://localhost');
  const token = searchParams.get('token');

  if (!token) {
    return res.status(400).send('Missing token');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return res.status(400).send('Invalid token format');
  }

  // Lazy Supabase init (inside handler, not top-level)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: prediction, error } = await supabase
    .from('predictions')
    .select(`
      *,
      matches(
        id, home_team, away_team,
        home_team_id, away_team_id,
        kickoff_time
      )
    `)
    .eq('share_token', token)
    .single();

  // If prediction not found, return a fallback brand image
  if (error || !prediction) {
    return sendImage(res, fallbackImage(), 1200, 630, 3600);
  }

  // Guard lost/cancelled cards — return fallback immediately
  const settledStatus = prediction.settled_status;
  const predStatus = prediction.status;
  if (settledStatus === 'LOST' || predStatus === 'CANCELLED') {
    return sendImage(res, fallbackImage(), 1200, 630, 3600);
  }

  // Fetch team badges from the teams table
  const homeTeamId = prediction.matches?.home_team_id;
  const awayTeamId = prediction.matches?.away_team_id;

  let homeBadgeUrl = null;
  let awayBadgeUrl = null;

  if (homeTeamId && awayTeamId) {
    const { data: teams } = await supabase
      .from('teams')
      .select('team_id, image_path')
      .in('team_id', [homeTeamId, awayTeamId]);

    if (teams) {
      const homeTeam = teams.find(t => t.team_id === homeTeamId);
      const awayTeam = teams.find(t => t.team_id === awayTeamId);
      homeBadgeUrl = homeTeam?.image_path || null;
      awayBadgeUrl = awayTeam?.image_path || null;
    }
  }

  // Handle group share — when ?group=true and ?ids=id1,id2,id3 are present
  const isGroup = searchParams.get('group') === 'true';
  const idsParam = searchParams.get('ids');
  let groupPredictions = null;

  if (isGroup && idsParam) {
    const ids = idsParam.split(',').filter(Boolean);
    const { data: gp } = await supabase
      .from('predictions')
      .select('*')
      .in('id', ids)
      .eq('user_id', prediction.user_id)
      .neq('status', 'CANCELLED');

    // Filter out lost cards server-side
    groupPredictions = (gp || []).filter(p =>
      p.settled_status !== 'LOST' && p.status !== 'CANCELLED'
    );
  }

  // Derive display values
  const matchName = prediction.match_title
    || (prediction.matches
      ? `${prediction.matches.home_team} vs ${prediction.matches.away_team}`
      : 'Match');

  const matchDate = prediction.matches?.kickoff_time
    ? new Date(prediction.matches.kickoff_time).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short'
      })
    : '';

  const selectionLabel = prediction.team_name || prediction.selection_label || prediction.selection || 'Prediction';
  const cardConf = CARD_CONFIG[prediction.card_type] || CARD_CONFIG.c_supersub;
  const isWon = prediction.settled_status === 'WON';
  const isPre = !isWon;
  const points = prediction.points_awarded ?? prediction.potential_reward ?? 0;
  const maxAge = isPre ? 60 : 3600;

  // Route to correct renderer
  if (isGroup && groupPredictions && groupPredictions.length > 1) {
    return sendImage(
      res,
      groupCardImage({ groupPredictions, matchName, matchDate, homeBadgeUrl, awayBadgeUrl }),
      1200, 630, maxAge
    );
  }

  return sendImage(
    res,
    singleCardImage({ prediction, matchName, matchDate, selectionLabel, cardConf, isWon, isPre, points, homeBadgeUrl, awayBadgeUrl }),
    800, 1200, maxAge
  );
}

/** Render an ImageResponse and pipe its bytes into the Node.js res object. */
async function sendImage(res, jsx, width, height, maxAge) {
  const imageResponse = new ImageResponse(jsx, { width, height });
  const buffer = await imageResponse.arrayBuffer();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
  res.status(200).send(Buffer.from(buffer));
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

function singleCardImage({ prediction, matchName, matchDate, selectionLabel, cardConf, isWon, isPre, points, homeBadgeUrl, awayBadgeUrl }) {
  const cardBaseUrl = CARD_BASE_URLS[prediction.card_type] || CARD_BASE_URLS.c_supersub;
  const iconUrl = ICON_URLS[prediction.card_type] || ICON_URLS.c_supersub;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      position: 'relative', fontFamily: 'sans-serif',
      overflow: 'hidden',
    }}>
      {/* Card base background */}
      <img
        src={cardBaseUrl}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', objectFit: 'cover',
        }}
      />

      {/* Content layer */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        height: '100%', padding: '32px 28px',
      }}>

        {/* TOP: Team badges + match date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {homeBadgeUrl && (
            <img src={homeBadgeUrl} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: '12px', color: '#555', fontWeight: 700 }}>vs</span>
          {awayBadgeUrl && (
            <img src={awayBadgeUrl} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          )}
          {matchDate && (
            <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px', fontWeight: 600 }}>
              {matchDate}
            </span>
          )}
        </div>

        {/* TOP-RIGHT: Status badge — absolute */}
        {isWon && (
          <div style={{
            position: 'absolute', top: '32px', right: '28px',
            background: '#166534', borderRadius: '4px',
            padding: '4px 10px', display: 'flex',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>
              CALLED IT
            </span>
          </div>
        )}
        {isPre && (
          <div style={{
            position: 'absolute', top: '32px', right: '28px',
            background: 'rgba(0,0,0,0.12)', borderRadius: '4px',
            padding: '4px 10px', display: 'flex',
            border: '1px solid rgba(0,0,0,0.18)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#333', letterSpacing: '0.08em' }}>
              MY CALL
            </span>
          </div>
        )}

        {/* CENTRE: Icon + selection text */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src={iconUrl}
            style={{ width: '40%', height: 'auto', objectFit: 'contain', opacity: 0.25 }}
          />
          <span style={{
            marginTop: '20px', fontSize: '26px', fontWeight: 900,
            color: '#121212', textAlign: 'center', lineHeight: 1.15,
            maxWidth: '85%',
          }}>
            {selectionLabel}
          </span>
          {isWon && points > 0 && (
            <div style={{
              marginTop: '16px',
              background: 'rgba(22,101,52,0.1)',
              borderRadius: '20px', padding: '5px 18px', display: 'flex',
            }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#166534' }}>
                +{points} pts
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM: branding — sits above the footer bar baked into card base */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '58px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>
            supersub.mobi
          </span>
        </div>

      </div>
    </div>
  );
}

function groupCardImage({ groupPredictions, matchName, matchDate, homeBadgeUrl, awayBadgeUrl }) {
  const cappedPredictions = groupPredictions.slice(0, 4);
  const cardWidth = 220;
  const cardGap = 16;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#0D0D0D', fontFamily: 'sans-serif',
      padding: '40px 48px', position: 'relative',
      justifyContent: 'space-between',
    }}>

      {/* TOP: Match identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        {homeBadgeUrl && (
          <img src={homeBadgeUrl} style={{ width: 40, height: 40, objectFit: 'contain' }} />
        )}
        <span style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>
          {matchName}
        </span>
        {awayBadgeUrl && (
          <img src={awayBadgeUrl} style={{ width: 40, height: 40, objectFit: 'contain' }} />
        )}
        {matchDate && (
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px', fontWeight: 600 }}>
            {matchDate}
          </span>
        )}
        {/* MY CALLS badge right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex' }}>
          <div style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: '6px',
            padding: '5px 14px', border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>
              MY CALLS
            </span>
          </div>
        </div>
      </div>

      {/* CENTRE: Cards row */}
      <div style={{
        display: 'flex', flexDirection: 'row',
        gap: `${cardGap}px`, alignItems: 'flex-start',
        justifyContent: 'center', flex: 1,
      }}>
        {cappedPredictions.map((p) => {
          const cardBaseUrl = CARD_BASE_URLS[p.card_type] || CARD_BASE_URLS.c_supersub;
          const iconUrl = ICON_URLS[p.card_type] || ICON_URLS.c_supersub;
          const sel = p.team_name || p.selection_label || p.selection || '';
          const isWon = p.settled_status === 'WON';

          return (
            <div key={p.id} style={{
              width: `${cardWidth}px`,
              height: '320px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '8px',
            }}>
              <img
                src={cardBaseUrl}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column',
                height: '100%', padding: '12px 10px',
              }}>
                {isWon && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: '#166534', borderRadius: '3px',
                    padding: '2px 7px', display: 'flex',
                  }}>
                    <span style={{ fontSize: '8px', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>
                      WON
                    </span>
                  </div>
                )}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <img src={iconUrl} style={{ width: '45%', objectFit: 'contain', opacity: 0.2 }} />
                  <span style={{
                    marginTop: '10px', fontSize: '13px', fontWeight: 900,
                    color: '#121212', textAlign: 'center', lineHeight: 1.2,
                    maxWidth: '90%',
                  }}>
                    {sel}
                  </span>
                </div>
                {/* Bottom padding for footer bar baked into card base */}
                <div style={{ height: '28px' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM: branding */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
          supersub.mobi
        </span>
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: '100%', height: '3px', background: '#00E5FF',
      }} />
    </div>
  );
}
