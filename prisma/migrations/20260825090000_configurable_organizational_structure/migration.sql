-- Turn the existing scoped department model into an administrator-managed
-- organizational hierarchy without changing existing role or member links.
ALTER TABLE "departments"
  ADD COLUMN "unit_type" TEXT NOT NULL DEFAULT 'Департамент',
  ADD COLUMN "parent_id" TEXT,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "departments_parent_active_idx"
  ON "departments"("parent_id", "archived_at");

CREATE INDEX "departments_active_sort_idx"
  ON "departments"("archived_at", "sort_order");

CREATE UNIQUE INDEX "departments_active_parent_name_unique"
  ON "departments" ((COALESCE("parent_id", '')), (LOWER("name_kk")))
  WHERE "archived_at" IS NULL;

-- Enforce a valid, acyclic hierarchy even for direct database writes.
CREATE OR REPLACE FUNCTION validate_department_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."parent_id" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."parent_id" = NEW."id" THEN
    RAISE EXCEPTION 'organizational unit cannot be its own parent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "departments"
    WHERE "id" = NEW."parent_id" AND "archived_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'organizational unit parent must be active';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT "id", "parent_id"
      FROM "departments"
      WHERE "id" = NEW."parent_id"
      UNION ALL
      SELECT parent."id", parent."parent_id"
      FROM "departments" parent
      JOIN ancestors child ON parent."id" = child."parent_id"
    )
    SELECT 1 FROM ancestors WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'organizational unit hierarchy cannot contain a cycle';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_department_hierarchy_before_write
BEFORE INSERT OR UPDATE OF "parent_id" ON "departments"
FOR EACH ROW
EXECUTE FUNCTION validate_department_hierarchy();

-- A unit that still owns active access or child records must be emptied or
-- reassigned explicitly before archival. This prevents accidental access loss.
CREATE OR REPLACE FUNCTION protect_active_department_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."archived_at" IS NULL AND NEW."archived_at" IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM "departments"
      WHERE "parent_id" = OLD."id" AND "archived_at" IS NULL
    ) OR EXISTS (
      SELECT 1 FROM "person_department_assignments"
      WHERE "department_id" = OLD."id" AND "ended_at" IS NULL
    ) OR EXISTS (
      SELECT 1 FROM "user_roles"
      WHERE "scope_type" = 'department'
        AND "scope_id" = OLD."id"
        AND "revoked_at" IS NULL
    ) THEN
      RAISE EXCEPTION 'organizational unit has active children or assignments';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_department_before_archive
BEFORE UPDATE OF "archived_at" ON "departments"
FOR EACH ROW
EXECUTE FUNCTION protect_active_department_scope();

-- Organizational records are retired by archival so references and audit
-- history never lose their target.
CREATE OR REPLACE FUNCTION reject_department_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'organizational units must be archived, not deleted';
END;
$$;

CREATE TRIGGER prevent_department_delete
BEFORE DELETE ON "departments"
FOR EACH ROW
EXECUTE FUNCTION reject_department_delete();

CREATE TRIGGER prevent_department_truncate
BEFORE TRUNCATE ON "departments"
FOR EACH STATEMENT
EXECUTE FUNCTION reject_department_delete();

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-configurable-organizational-structure-20260825',
  'organizational_structure.model_installed',
  'organizational_structure',
  'phase-one',
  '{"hierarchy":true,"serverManaged":true,"departmentRolesRequireScope":true,"deletePolicy":"archive_only"}',
  'Install the administrator-managed organizational structure model',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
