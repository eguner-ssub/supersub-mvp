import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  const { id, date: dateParam } = req.query;

  try {
    // ── SCENARIO 1: Single Match by ID ──
    if (id) {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', Number(id))
        .single();

      if (error || !data) {
        console.error('❌ [Matches API] DB error:', error?.message);
        return res.status(200).json({ response: [] });
      }

      return res.status(200).json({ response: [data] });
    }

    // ── SCENARIO 2: Date-based feed ──
    // Default to today if no date provided
    const date = dateParam || new Date().toISOString().split('T')[0];

    // Query matches by the flat date column (YYYY-MM-DD)
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('date', date)
      .order('kickoff_time', { ascending: true });

    if (error) {
      console.error('❌ [Matches API] DB error:', error.message);
      return res.status(200).json({ response: [], error: 'DB_ERROR' });
    }

    console.log(`🌍 [Matches API] Supabase feed — date=${date}, found=${data?.length || 0} matches`);

    return res.status(200).json({
      response: data || [],
      date_queried: date,
      source: 'supabase',
    });

  } catch (error) {
    console.error('❌ [Matches API] Error:', error.message);
    return res.status(200).json({ response: [], error: 'INTERNAL_ERROR' });
  }
}