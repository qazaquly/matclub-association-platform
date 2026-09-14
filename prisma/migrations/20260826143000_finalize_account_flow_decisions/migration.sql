ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS joining_purpose text;
ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS joining_purpose text;

-- Legacy names are intentionally not parsed. The previous display name is copied
-- into given_name; surname and patronymic remain unknown until the person corrects them.
UPDATE person_profiles
SET given_name = full_name
WHERE given_name IS NULL
  AND surname IS NULL
  AND created_at < timestamptz '2026-08-26T08:00:00Z';

UPDATE membership_application_drafts
SET given_name = full_name
WHERE given_name IS NULL
  AND surname IS NULL
  AND created_at < timestamptz '2026-08-26T08:00:00Z';

-- Duplicate-person detection was explicitly deferred. Refuse to remove anything
-- if a record somehow exists; the table is empty in the current development migration.
DO $$
BEGIN
  IF to_regclass('public.possible_duplicate_profiles') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM possible_duplicate_profiles) THEN
      RAISE EXCEPTION 'possible_duplicate_profiles is not empty';
    END IF;
    DROP TABLE possible_duplicate_profiles;
  END IF;
END
$$;
