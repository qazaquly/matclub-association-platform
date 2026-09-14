ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Existing production accounts predate ownership verification. Preserve their access;
-- only accounts created after this migration start unverified.
UPDATE users
SET email_verified_at = COALESCE(last_login_at, created_at)
WHERE email_verified_at IS NULL
  AND created_at < timestamptz '2026-08-26T08:00:00Z';

ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS surname text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS given_name text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS patronymic text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_level_code text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_institution text;
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_program text;

ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS surname text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS given_name text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS patronymic text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_level_code text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_institution text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_program text;
ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS privacy_accepted boolean NOT NULL DEFAULT false;

ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS privacy_policy_version text;
ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx
  ON email_verification_tokens(user_id, created_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx
  ON password_reset_tokens(user_id, created_at);

CREATE TABLE IF NOT EXISTS possible_duplicate_profiles (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES person_profiles(id) ON DELETE RESTRICT,
  candidate_profile_id text NOT NULL REFERENCES person_profiles(id) ON DELETE RESTRICT,
  reason_json text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT possible_duplicate_profiles_distinct CHECK (profile_id <> candidate_profile_id),
  CONSTRAINT possible_duplicate_profiles_pair_unique UNIQUE (profile_id, candidate_profile_id)
);
CREATE INDEX IF NOT EXISTS possible_duplicate_profiles_status_idx
  ON possible_duplicate_profiles(status, detected_at);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_derive_pbkdf2_sha256(
  candidate_password text,
  password_salt bytea,
  password_iterations integer
)
RETURNS bytea
LANGUAGE plpgsql
STRICT
VOLATILE
PARALLEL RESTRICTED
SET search_path = pg_catalog, public
AS $$
DECLARE
  password_bytes bytea := convert_to(candidate_password, 'UTF8');
  current_block bytea;
  derived_block bytea;
  iteration_index integer;
BEGIN
  IF password_iterations < 100000
    OR password_iterations > 1000000
    OR octet_length(password_salt) < 8
  THEN
    RAISE EXCEPTION 'invalid PBKDF2 parameters';
  END IF;

  current_block := hmac(password_salt || decode('00000001', 'hex'), password_bytes, 'sha256');
  derived_block := current_block;

  FOR iteration_index IN 2..password_iterations LOOP
    current_block := hmac(current_block, password_bytes, 'sha256');
    derived_block := substring(
      bit_send(
        (('x' || encode(derived_block, 'hex'))::bit(256))
        # (('x' || encode(current_block, 'hex'))::bit(256))
      )
      FROM 5
    );
  END LOOP;

  RETURN derived_block;
END;
$$;

CREATE OR REPLACE FUNCTION app_verify_pbkdf2_sha256(
  candidate_password text,
  password_salt bytea,
  password_iterations integer,
  expected_hash bytea
)
RETURNS boolean
LANGUAGE sql
STRICT
VOLATILE
PARALLEL RESTRICTED
SET search_path = pg_catalog, public
AS $$
  SELECT octet_length(expected_hash) = 32
    AND app_derive_pbkdf2_sha256(candidate_password, password_salt, password_iterations) = expected_hash
$$;

COMMENT ON FUNCTION app_derive_pbkdf2_sha256(text, bytea, integer)
  IS 'Derives Phase 1 PBKDF2-SHA256 password hashes outside the Cloudflare Worker CPU budget.';
