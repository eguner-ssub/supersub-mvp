-- Migration 000: Create profiles table
--
-- profiles is the core user record. On production it was created manually
-- before the migration chain began. This file bootstraps it for new
-- environments (e.g. staging) so that migration 001 onward can assume
-- the table exists.
--
-- Schema reconstructed from:
--   • GameContext.jsx.bak — original createProfile() payload
--     (name, club_name, coins=500, energy=3, max_energy=5, updated_at)
--   • migration 001 — RPC reads max_energy; adds ads_watched column
--   • migration 024 — renames coins → points (so original column is coins)
-- All subsequent ALTER TABLE … ADD COLUMN statements use IF NOT EXISTS,
-- so they are safe to run on top of this base table.

CREATE TABLE IF NOT EXISTS profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    club_name   TEXT,
    coins       INT         NOT NULL DEFAULT 0,
    energy      INT         NOT NULL DEFAULT 3,
    max_energy  INT         NOT NULL DEFAULT 5,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger: auto-create a profile row on new user signup ────────────────────
-- Supabase fires this on INSERT into auth.users. The row is sparse —
-- name, club_name etc. are filled in during onboarding.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
