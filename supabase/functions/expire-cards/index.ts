import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deletes all inventory rows whose expires_at has passed.
// Scheduled: Tuesday 00:05 UTC (runs after Monday 23:59 expiry window closes).
// Safe to run multiple times — idempotent DELETE.

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log('🗑️  expire-cards — invocation start');

  const { error, count } = await supabase
    .from('inventory')
    .delete({ count: 'exact' })
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('expire-cards: delete failed', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`🗑️  expire-cards — deleted ${count ?? 0} row(s)`);
  return new Response(JSON.stringify({ deleted: count ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
