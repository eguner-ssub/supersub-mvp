/**
 * GET /api/debug-env
 * Temporary endpoint to check which env vars are set.
 * DELETE THIS FILE after debugging.
 */
export default function handler(req, res) {
  return res.status(200).json({
    CRON_SECRET: process.env.CRON_SECRET ? '✓ set' : '✗ missing',
    SPORTMONKS_API_TOKEN: process.env.SPORTMONKS_API_TOKEN ? '✓ set' : '✗ missing',
    SUPABASE_URL: process.env.SUPABASE_URL ? '✓ set' : '✗ missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing',
  });
}
