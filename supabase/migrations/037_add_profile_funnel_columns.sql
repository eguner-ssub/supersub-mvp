-- Migration 037: Add referral_code and has_seen_welcome to profiles
-- referral_code   — optional at signup, stored for future viral mechanic
-- has_seen_welcome — set to true after the new-user bag overlay is collected

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code    TEXT,
  ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN NOT NULL DEFAULT false;
