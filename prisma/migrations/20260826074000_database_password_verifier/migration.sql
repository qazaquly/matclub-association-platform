CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION app_verify_pbkdf2_sha256(
  candidate_password text,
  password_salt bytea,
  password_iterations integer,
  expected_hash bytea
)
RETURNS boolean
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
    OR octet_length(expected_hash) <> 32
  THEN
    RETURN false;
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

  RETURN derived_block = expected_hash;
END;
$$;

COMMENT ON FUNCTION app_verify_pbkdf2_sha256(text, bytea, integer, bytea)
  IS 'Verifies existing PBKDF2-SHA256 password hashes outside the Cloudflare Worker CPU budget.';
