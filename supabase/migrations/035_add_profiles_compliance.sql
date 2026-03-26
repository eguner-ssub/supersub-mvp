-- Migration 035: Compliance columns on profiles
--
-- Adds:
--   profiles.terms_accepted_at  — timestamp when user accepted ToS + PP
--   profiles.is_age_verified    — true when user confirmed 18+ at signup
--
-- Both columns are required before any affiliate CTA is shown to a user.
-- The PostPredictionSheet and WinCelebrationModal components check
-- is_age_verified === true before rendering.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_age_verified   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.terms_accepted_at IS
  'Timestamp when the user checked "I agree to the Terms of Service and Privacy Policy" at signup. '
  'NULL for users who signed up before this migration.';

COMMENT ON COLUMN profiles.is_age_verified IS
  'True when the user checked "I confirm I am 18 or over" at signup. '
  'Gates all affiliate CTA rendering. False by default for existing users.';
