// TEMPORARY DEBUG ENDPOINT — DELETE AFTER DIAGNOSIS
// Exposes env var metadata (NOT the actual password) to confirm the
// deployed function can read STATS_GEN_PASSWORD correctly.
export default function handler(req, res) {
  const expected = process.env.STATS_GEN_PASSWORD;
  const serviceToken = process.env.STATS_GEN_SERVICE_TOKEN;
  res.status(200).json({
    stats_gen_password: {
      is_set: !!expected,
      length: expected?.length || 0,
      first_3: expected?.slice(0, 3) || null,
      last_3: expected?.slice(-3) || null,
      has_trailing_whitespace: expected !== expected?.trim(),
      char_codes_first_3: expected ? Array.from(expected.slice(0, 3)).map(c => c.charCodeAt(0)) : null,
      char_codes_last_3: expected ? Array.from(expected.slice(-3)).map(c => c.charCodeAt(0)) : null,
    },
    stats_gen_service_token: {
      is_set: !!serviceToken,
      length: serviceToken?.length || 0,
    },
    deployment_info: {
      vercel_env: process.env.VERCEL_ENV || null,
      vercel_url: process.env.VERCEL_URL || null,
      node_version: process.version,
    },
    timestamp: new Date().toISOString(),
  });
}
