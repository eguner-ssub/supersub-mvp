import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_LEAGUE_IDS } from '../src/shared/config/coverage.js';

export default async function handler(req, res) {
  // ── Environment Guard Rails ──
  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    return res.status(500).json({ error: 'Missing Environment Variables', missing });
  }

  try {
    // Lazy init — created per-request inside try/catch
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id, date: dateParam } = req.query;

    // ── SCENARIO 1: Single Match by ID ──
    if (id) {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', Number(id))
        .single();

      if (error || !data) {
        return res.status(200).json({ response: [], error: error?.message });
      }

      return res.status(200).json({ response: [data] });
    }

    // ── SCENARIO 2: Date-based feed ──
    const date = dateParam || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('date', date)
      .in('league_id', SUPPORTED_LEAGUE_IDS)
      .order('kickoff_time', { ascending: true });

    if (error) {
      return res.status(200).json({ response: [], error: error.message });
    }

    console.log(`🌍 [Matches API] date=${date}, found=${data?.length || 0} matches`);

    return res.status(200).json({
      response: data || [],
      date_queried: date,
      source: 'supabase',
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}