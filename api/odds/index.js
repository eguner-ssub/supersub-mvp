import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Lazy Supabase Client ──────────────────────────────────────────────────────
let _client = null;

function getSupabaseClient() {
    if (_client) return _client;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            `Missing env vars – SUPABASE_URL: ${url ? '✓' : '✗'}, SUPABASE_SERVICE_ROLE_KEY: ${key ? '✓' : '✗'}`
        );
    }

    _client = createClient(url, key);
    return _client;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    const { fixture } = req.query;

    console.log('🔍 [ODDS API] Fixture ID received:', fixture);

    if (!fixture) {
        console.log('❌ [ODDS API] Missing fixture ID');
        return res.status(400).json({ error: "Missing fixture ID" });
    }

    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('matches')
            .select('odds')
            .eq('id', Number(fixture))
            .single();

        if (error) {
            console.error('❌ [ODDS API] Supabase error:', error.message);
            return res.status(200).json({ response: [] });
        }

        console.log('✅ [ODDS API] Returning cached odds from DB');
        return res.status(200).json({ response: data?.odds || [] });
    } catch (err) {
        console.error('❌ [ODDS API] Error:', err.message);
        return res.status(200).json({ response: [] });
    }
}
