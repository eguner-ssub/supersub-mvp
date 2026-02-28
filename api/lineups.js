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

    if (!fixture) {
        return res.status(400).json({ error: "Missing 'fixture' query parameter" });
    }

    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('matches')
            .select('lineups')
            .eq('id', Number(fixture))
            .single();

        if (error) {
            console.error(`❌ [Lineups API] Supabase error:`, error.message);
            return res.status(500).json({ response: [], error: error.message });
        }

        return res.status(200).json({ response: data?.lineups || [] });
    } catch (err) {
        console.error('❌ [Lineups API] Error:', err.message);
        return res.status(500).json({
            error: 'API_INIT_FAILED',
            message: err.message || 'Environment variables missing on server.',
        });
    }
}
