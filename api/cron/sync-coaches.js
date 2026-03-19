import { createClient } from '@supabase/supabase-js';

// ── Lazy Supabase client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`);
  _client = createClient(url, key);
  return _client;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow POST (cron triggers send POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the shared secret
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET env var not configured' });
  }
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SPORTMONKS_API_TOKEN env var not configured' });
  }

  try {
    const supabase = getSupabaseClient();

    // Load existing coaches from DB so we can detect manager changes
    const { data: existingCoaches } = await supabase
      .from('coaches')
      .select('id, current_team_id');
    const existingMap = new Map((existingCoaches || []).map((c) => [c.id, c.current_team_id]));

    // Fetch all pages of recently-updated coaches from Sportmonks
    const allCoaches = [];
    let page = 1;

    while (true) {
      const url = new URL('https://api.sportmonks.com/v3/football/coaches/latest');
      url.searchParams.set('api_token', token);
      url.searchParams.set('include', 'teams');
      url.searchParams.set('page', String(page));

      const apiRes = await fetch(url.toString());
      if (!apiRes.ok) {
        throw new Error(`Sportmonks ${apiRes.status} on /coaches/latest page ${page}`);
      }
      const json = await apiRes.json();
      const entries = json.data || [];
      allCoaches.push(...entries);

      if (!json.pagination?.has_more) break;
      page++;
      await sleep(500);
    }

    if (allCoaches.length === 0) {
      return res.status(200).json({ ok: true, updated: 0 });
    }

    // Build upsert rows, detect manager changes
    const rows = [];
    const managerChanges = [];

    for (const coach of allCoaches) {
      // Find the active team from the included teams array
      const teams = coach.teams || [];
      const activeTeam =
        teams.find((t) => t.pivot?.active === true) ||
        teams.find((t) => t.active === true) ||
        teams[teams.length - 1] ||
        null;

      const newTeamId = activeTeam?.id ?? null;
      const oldTeamId = existingMap.get(coach.id);

      if (oldTeamId !== undefined && oldTeamId !== newTeamId) {
        managerChanges.push(
          `${coach.display_name || coach.name}: team ${oldTeamId} → ${newTeamId}`
        );
      }

      rows.push({
        id:             coach.id,
        name:           coach.name || coach.display_name || `Coach ${coach.id}`,
        common_name:    coach.common_name  ?? null,
        firstname:      coach.firstname    ?? null,
        lastname:       coach.lastname     ?? null,
        image_path:     coach.image_path   ?? null,
        nationality_id: coach.nationality_id ?? null,
        current_team_id: newTeamId,
        last_updated:   new Date().toISOString(),
      });
    }

    const { error } = await supabase
      .from('coaches')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw new Error(`Coaches upsert failed: ${error.message}`);

    if (managerChanges.length > 0) {
      console.log('[sync-coaches] Manager changes detected:');
      managerChanges.forEach((change) => console.log(`  ↻ ${change}`));
    }

    console.log(`[sync-coaches] ✓ ${rows.length} coaches upserted, ${managerChanges.length} manager changes`);

    return res.status(200).json({
      ok: true,
      updated: rows.length,
      managerChanges: managerChanges.length,
    });
  } catch (err) {
    console.error('[sync-coaches] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
