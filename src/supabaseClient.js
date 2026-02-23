import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

// ── Defensive Guard ─────────────────────────────────────────────────────────
// Provides a clear, actionable error instead of a cryptic TypeError
if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        `%c[⚙ SUPERSUB] Supabase init FAILED%c\n` +
        `  SUPABASE_URL:      ${supabaseUrl ? '✓' : '✗ MISSING'}\n` +
        `  SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗ MISSING'}\n` +
        `  Check .env and vite.config.js envPrefix.`,
        'color: #ff4444; font-weight: bold; font-size: 14px',
        'color: #ff9999'
    );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');