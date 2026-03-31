-- Migration 039: Add onboarding_complete to profiles
-- onboarding_complete — set to true after the Joseba first-time onboarding flow
--                       finishes in ManagerOffice. Controls whether OfficeOnboarding
--                       renders on next visit. Defaults false so all existing rows
--                       (and all new sign-ups) start the flow.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
