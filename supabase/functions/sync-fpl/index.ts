import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * FPL Market Trends Sync
 *
 * Fetches the most popular player transfers from the Fantasy Premier League
 * internal API and upserts the top 50 into the `fpl_transfers` table.
 *
 * Scheduled via pg_cron every 6 hours.
 */

const FPL_API_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const TOP_N = 50;

Deno.serve(async (_req) => {
  const started = Date.now();

  console.log('[sync-fpl] ══════ Invocation start ══════');

  // ── Supabase client (service role) ───────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── 1. Fetch FPL bootstrap data ─────────────────
  let fplData: any;
  try {
    const res = await fetch(FPL_API_URL);
    if (!res.ok) {
      throw new Error(`FPL API returned ${res.status}`);
    }
    fplData = await res.json();
  } catch (err) {
    console.error('[sync-fpl] Failed to fetch FPL API:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'FPL API fetch failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { teams, elements } = fplData;

  if (!teams || !elements) {
    console.error('[sync-fpl] Malformed FPL response — missing teams or elements');
    return new Response(
      JSON.stringify({ success: false, error: 'Malformed FPL response' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── 2. Build team lookup { id → name } ──────────
  const teamLookup: Record<number, string> = {};
  for (const t of teams) {
    teamLookup[t.id] = t.name;
  }

  console.log(`[sync-fpl] Loaded ${teams.length} teams, ${elements.length} players`);

  // ── 3. Sort by transfers_in_event DESC, take top 50 ──
  const topPlayers = [...elements]
    .sort((a: any, b: any) => (b.transfers_in_event ?? 0) - (a.transfers_in_event ?? 0))
    .slice(0, TOP_N);

  // ── 4. Map to fpl_transfers row shape ───────────
  const rows = topPlayers.map((p: any) => ({
    player_id:          p.id,
    web_name:           p.web_name,
    team_name:          teamLookup[p.team] ?? 'Unknown',
    now_cost:           (p.now_cost ?? 0) / 10,
    transfers_in_event: p.transfers_in_event ?? 0,
    form:               parseFloat(p.form) || 0,
    total_points:       p.total_points ?? 0,
    photo_url:          `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png`,
    updated_at:         new Date().toISOString(),
  }));

  console.log(`[sync-fpl] Mapped ${rows.length} players for upsert`);

  // ── 5. Upsert into fpl_transfers ────────────────
  const { error } = await supabase
    .from('fpl_transfers')
    .upsert(rows, { onConflict: 'player_id' });

  if (error) {
    console.error('[sync-fpl] Upsert error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const elapsed = Date.now() - started;
  console.log(`[sync-fpl] ══════ Done — ${rows.length} players upserted in ${elapsed}ms ══════`);

  return new Response(
    JSON.stringify({
      success: true,
      count: rows.length,
      elapsed_ms: elapsed,
      synced_at: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
