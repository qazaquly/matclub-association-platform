import { Prisma } from "@/generated/prisma/client";
import { getDb } from "./index";
import { encodePbkdf2PasswordHash, parsePbkdf2PasswordHash, PASSWORD_ITERATIONS } from "@/lib/security";

const passwordDeriverFunctionSql = String.raw`
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
AS $function$
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
$function$`;

const passwordVerifierFunctionSql = String.raw`
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
AS $function$
  SELECT octet_length(expected_hash) = 32
    AND app_derive_pbkdf2_sha256(candidate_password, password_salt, password_iterations) = expected_hash
$function$`;

export async function ensureDatabasePasswordVerifier(database = getDb()) {
  await database.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(734220260826)::text AS lock_state
    `);
    const [state] = await transaction.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
      SELECT to_regprocedure('app_verify_pbkdf2_sha256(text,bytea,integer,bytea)') IS NOT NULL
        AND to_regprocedure('app_derive_pbkdf2_sha256(text,bytea,integer)') IS NOT NULL AS ready
    `);
    if (state?.ready) return;
    await transaction.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await transaction.$executeRawUnsafe(passwordDeriverFunctionSql);
    await transaction.$executeRawUnsafe(passwordVerifierFunctionSql);
  });
}

export async function hashPasswordInDatabase(
  database: ReturnType<typeof getDb>,
  password: string,
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const [result] = await database.$queryRaw<Array<{ derived: Uint8Array }>>(Prisma.sql`
    SELECT app_derive_pbkdf2_sha256(${password}, ${salt}::bytea, ${PASSWORD_ITERATIONS}) AS derived
  `);
  if (!result?.derived) throw new Error("PASSWORD_DERIVATION_FAILED");
  return encodePbkdf2PasswordHash(salt, new Uint8Array(result.derived), PASSWORD_ITERATIONS);
}

export async function verifyPasswordInDatabase(
  database: ReturnType<typeof getDb>,
  password: string,
  encoded: string,
) {
  const parsed = parsePbkdf2PasswordHash(encoded);
  if (!parsed) return false;
  const [result] = await database.$queryRaw<Array<{ verified: boolean }>>(Prisma.sql`
    SELECT app_verify_pbkdf2_sha256(
      ${password},
      ${parsed.salt}::bytea,
      ${parsed.iterations},
      ${parsed.expected}::bytea
    ) AS verified
  `);
  return result?.verified === true;
}
