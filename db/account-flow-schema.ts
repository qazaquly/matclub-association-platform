import { getDb } from "./index";

const statements = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz`,
  `UPDATE users SET email_verified_at = COALESCE(last_login_at, created_at)
   WHERE email_verified_at IS NULL AND created_at < timestamptz '2026-08-26T08:00:00Z'`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS surname text`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS given_name text`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS patronymic text`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS birth_date date`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_level_code text`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_institution text`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS education_program text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS surname text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS given_name text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS patronymic text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS birth_date date`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_level_code text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_institution text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS education_program text`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS privacy_accepted boolean NOT NULL DEFAULT false`,
  `ALTER TABLE membership_application_drafts ADD COLUMN IF NOT EXISTS joining_purpose text`,
  `ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS privacy_policy_version text`,
  `ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz`,
  `ALTER TABLE membership_applications ADD COLUMN IF NOT EXISTS joining_purpose text`,
  `UPDATE person_profiles SET given_name = full_name
   WHERE given_name IS NULL AND surname IS NULL AND created_at < timestamptz '2026-08-26T08:00:00Z'`,
  `UPDATE membership_application_drafts SET given_name = full_name
   WHERE given_name IS NULL AND surname IS NULL AND created_at < timestamptz '2026-08-26T08:00:00Z'`,
  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx ON email_verification_tokens(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx ON password_reset_tokens(user_id, created_at)`,
  `DO $$
   BEGIN
     IF to_regclass('public.possible_duplicate_profiles') IS NOT NULL THEN
       IF EXISTS (SELECT 1 FROM possible_duplicate_profiles) THEN
         RAISE EXCEPTION 'possible_duplicate_profiles is not empty';
       END IF;
       DROP TABLE possible_duplicate_profiles;
     END IF;
   END
   $$`,
] as const;

export async function ensureAccountFlowSchema(database = getDb()) {
  await database.$transaction(async (transaction) => {
    await transaction.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(7342202608261)::text AS lock_state`);
    const [state] = await transaction.$queryRawUnsafe<Array<{ ready: boolean }>>(`
      SELECT to_regclass('public.email_verification_tokens') IS NOT NULL
        AND to_regclass('public.password_reset_tokens') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'membership_application_drafts' AND column_name = 'privacy_accepted'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'membership_application_drafts' AND column_name = 'joining_purpose'
        )
        AND to_regclass('public.possible_duplicate_profiles') IS NULL AS ready
    `);
    if (state?.ready) return;
    for (const statement of statements) await transaction.$executeRawUnsafe(statement);
  });
}
