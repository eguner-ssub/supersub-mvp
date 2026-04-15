-- Add UNIQUE constraint to profiles.club_name so two managers can't share an identity.
-- Two-step migration so it's safe to run against databases that already contain duplicates
-- (test data on dev/staging from manual signup testing).

-- Step 1: rename any existing duplicates by appending the user-id prefix.
-- ROW_NUMBER >= 2 means "this is the 2nd+ row sharing the name (case-insensitive)" —
-- those get suffixed; the earliest row keeps the bare name.
UPDATE profiles
SET club_name = club_name || '-' || substr(id::text, 1, 8)
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(club_name) ORDER BY id) AS rn
    FROM profiles
    WHERE club_name IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: enforce uniqueness from now on.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_club_name_key UNIQUE (club_name);
