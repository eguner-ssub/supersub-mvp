-- Add training_onboarding_seen flag so the Joseba briefing bubble on /training
-- shows exactly once per user. Default false → every existing user sees it on
-- their next visit; tapping the bubble flips it to true via a client-side update.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS training_onboarding_seen BOOLEAN DEFAULT false;
