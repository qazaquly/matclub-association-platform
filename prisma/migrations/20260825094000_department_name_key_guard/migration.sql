-- Keep the normalized sibling-name key correct for application and direct SQL
-- writes. translate() is explicit because the database uses the portable C
-- locale, whose lower() does not case-fold Kazakh Cyrillic reliably.
DROP INDEX IF EXISTS "departments_active_parent_name_key_unique";

CREATE OR REPLACE FUNCTION normalize_department_name_key(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT trim(regexp_replace(
    translate(
      input,
      'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ',
      'аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

WITH normalized AS (
  SELECT
    "id",
    normalize_department_name_key("name_kk") AS normalized_key,
    row_number() OVER (
      PARTITION BY COALESCE("parent_id", ''), normalize_department_name_key("name_kk")
      ORDER BY "created_at", "id"
    ) AS duplicate_rank
  FROM "departments"
  WHERE "archived_at" IS NULL
)
UPDATE "departments" department
SET "name_key" = CASE
  WHEN normalized.duplicate_rank = 1 THEN normalized.normalized_key
  ELSE normalized.normalized_key || '#' || department."id"
END
FROM normalized
WHERE department."id" = normalized."id";

UPDATE "departments"
SET "name_key" = normalize_department_name_key("name_kk")
WHERE "archived_at" IS NOT NULL;

CREATE UNIQUE INDEX "departments_active_parent_name_key_unique"
  ON "departments" ((COALESCE("parent_id", '')), "name_key")
  WHERE "archived_at" IS NULL;

CREATE OR REPLACE FUNCTION set_department_name_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."name_key" := normalize_department_name_key(NEW."name_kk");
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_department_name_key_before_write
BEFORE INSERT OR UPDATE OF "name_kk" ON "departments"
FOR EACH ROW
EXECUTE FUNCTION set_department_name_key();
