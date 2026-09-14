-- PostgreSQL databases initialized with the C locale do not provide reliable
-- Unicode case folding for Kazakh text. Persist the application-normalized key
-- so sibling-name uniqueness is deterministic in every environment.
ALTER TABLE "departments" ADD COLUMN "name_key" TEXT;

UPDATE "departments" SET "name_key" = "name_kk" WHERE "name_key" IS NULL;

ALTER TABLE "departments" ALTER COLUMN "name_key" SET NOT NULL;

DROP INDEX IF EXISTS "departments_active_parent_name_unique";

CREATE UNIQUE INDEX "departments_active_parent_name_key_unique"
  ON "departments" ((COALESCE("parent_id", '')), "name_key")
  WHERE "archived_at" IS NULL;
