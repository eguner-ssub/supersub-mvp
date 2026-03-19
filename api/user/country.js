import { createClient } from '@supabase/supabase-js';

let _client = null;

function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`);
  _client = createClient(url, key);
  return _client;
}

/**
 * GET  /api/user/country — returns inferred country from Vercel header
 * PATCH /api/user/country — user sets country manually
 *
 * Both require a valid Supabase JWT in the Authorization header.
 */
export default async function handler(req, res) {
  const supabase = getSupabaseClient();

  // Authenticate user via JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (req.method === 'GET') {
    // Return the inferred country from Vercel's edge header.
    // The frontend calls this once after auth to capture the user's country.
    const inferredCountry = req.headers['x-vercel-ip-country'] || null;

    // If user doesn't have a country set yet, auto-save the inferred one
    if (inferredCountry) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('id', user.id)
        .single();

      if (profile && !profile.country_code) {
        await supabase
          .from('profiles')
          .update({ country_code: inferredCountry, country_source: 'inferred' })
          .eq('id', user.id);
      }
    }

    return res.status(200).json({ country_code: inferredCountry });
  }

  if (req.method === 'PATCH') {
    const { country_code } = req.body || {};
    if (!country_code || typeof country_code !== 'string' || country_code.length !== 2) {
      return res.status(400).json({ error: 'country_code must be a 2-letter ISO code' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        country_code: country_code.toUpperCase(),
        country_source: 'manual',
      })
      .eq('id', user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, country_code: country_code.toUpperCase() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
