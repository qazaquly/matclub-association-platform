-- Explicit, many-to-many department membership controlled by central administration.
CREATE TABLE "departments" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_kk" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

CREATE TABLE "person_department_assignments" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "assigned_by" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_by" TEXT,
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "person_department_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_department_assignments_person_idx"
  ON "person_department_assignments"("person_id");
CREATE INDEX "person_department_assignments_department_active_idx"
  ON "person_department_assignments"("department_id", "ended_at");
CREATE UNIQUE INDEX "person_department_assignments_active_unique"
  ON "person_department_assignments"("person_id", "department_id")
  WHERE "ended_at" IS NULL;

ALTER TABLE "person_department_assignments"
  ADD CONSTRAINT "person_department_assignments_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_department_assignments"
  ADD CONSTRAINT "person_department_assignments_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_department_assignments"
  ADD CONSTRAINT "person_department_assignments_assigned_by_fkey"
  FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_department_assignments"
  ADD CONSTRAINT "person_department_assignments_ended_by_fkey"
  FOREIGN KEY ("ended_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "departments" ("id", "code", "name_kk", "description", "created_at", "updated_at")
VALUES (
  'dept-content',
  'mathematics-content-professional-development',
  'Математика, мазмұн және кәсіби даму департаменті',
  'Phase 1 кәсіби міндеттеріне арналған ішкі бөлім',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "person_department_assignments" ("id", "person_id", "department_id", "assigned_by", "assigned_at")
SELECT 'department-assignment-head', 'person-dept-head', 'dept-content', 'user-president', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "person_profiles" WHERE "id" = 'person-dept-head');

INSERT INTO "person_department_assignments" ("id", "person_id", "department_id", "assigned_by", "assigned_at")
SELECT 'department-assignment-member', 'person-member', 'dept-content', 'user-president', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "person_profiles" WHERE "id" = 'person-member');

-- Attribute the initial applicant transition to the account that submitted it.
UPDATE "membership_status_history"
SET "changed_by" = 'user-applicant'
WHERE "id" = 'history-applicant'
  AND "changed_by" IS NULL
  AND EXISTS (SELECT 1 FROM "users" WHERE "id" = 'user-applicant');

-- Membership status history is append-only at the PostgreSQL layer.
CREATE OR REPLACE FUNCTION reject_membership_status_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'membership_status_history is append-only';
END;
$$;

CREATE TRIGGER prevent_membership_status_history_update_or_delete
BEFORE UPDATE OR DELETE ON "membership_status_history"
FOR EACH ROW
EXECUTE FUNCTION reject_membership_status_history_mutation();

CREATE TRIGGER prevent_membership_status_history_truncate
BEFORE TRUNCATE ON "membership_status_history"
FOR EACH STATEMENT
EXECUTE FUNCTION reject_membership_status_history_mutation();



INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
)
VALUES (
  'audit-department-model-20260807',
  'authorization.department_model_added',
  'department',
  'dept-content',
  '{"assignmentModel":"explicit_many_to_many","history":"append_only"}',
  'Phase 1 access-boundary correction',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
