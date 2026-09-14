-- Internal project management: scoped ownership, stages, participants, results,
-- private documents, public CMS linkage, and unified person activity history.

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "code" TEXT,
  "summary" TEXT NOT NULL,
  "description" TEXT,
  "project_scope" TEXT NOT NULL,
  "branch_id" TEXT,
  "responsible_department_id" TEXT,
  "leader_profile_id" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "status_note" TEXT,
  "public_project_id" TEXT,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_scope_check" CHECK ("project_scope" IN ('NATIONAL', 'BRANCH')),
  CONSTRAINT "projects_scope_owner_check" CHECK (
    ("project_scope" = 'NATIONAL' AND "branch_id" IS NULL) OR
    ("project_scope" = 'BRANCH' AND "branch_id" IS NOT NULL)
  ),
  CONSTRAINT "projects_status_check" CHECK ("status" IN ('DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED')),
  CONSTRAINT "projects_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
  CONSTRAINT "projects_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 240),
  CONSTRAINT "projects_summary_check" CHECK (length(btrim("summary")) BETWEEN 1 AND 2000)
);

CREATE TABLE "project_stages" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_stages_status_check" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT "project_stages_dates_check" CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"),
  CONSTRAINT "project_stages_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 240)
);

CREATE TABLE "project_participants" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "participant_role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_participants_role_check" CHECK ("participant_role" IN ('LEADER', 'COORDINATOR', 'PARTICIPANT', 'EXPERT', 'VOLUNTEER')),
  CONSTRAINT "project_participants_status_check" CHECK ("status" IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN')),
  CONSTRAINT "project_participants_dates_check" CHECK (
    ("status" = 'ACTIVE' AND "ended_at" IS NULL) OR
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL) OR
    ("status" = 'WITHDRAWN' AND "ended_at" IS NOT NULL)
  )
);

CREATE TABLE "project_results" (
  "project_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "outcomes" TEXT,
  "deliverables" TEXT,
  "beneficiary_count" INTEGER,
  "completed_at" DATE,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_results_pkey" PRIMARY KEY ("project_id"),
  CONSTRAINT "project_results_beneficiary_count_check" CHECK ("beneficiary_count" IS NULL OR "beneficiary_count" >= 0),
  CONSTRAINT "project_results_summary_check" CHECK (length(btrim("summary")) BETWEEN 1 AND 10000)
);

CREATE TABLE "project_documents" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "uploaded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_documents_category_check" CHECK ("category" IN ('PLAN', 'AGREEMENT', 'REPORT', 'RESULT', 'OTHER')),
  CONSTRAINT "project_documents_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "project_documents_size_check" CHECK ("size_bytes" > 0)
);

CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");
CREATE UNIQUE INDEX "projects_public_project_id_key" ON "projects"("public_project_id");
CREATE INDEX "projects_status_start_idx" ON "projects"("status", "start_date");
CREATE INDEX "projects_branch_status_idx" ON "projects"("branch_id", "status");
CREATE INDEX "projects_department_status_idx" ON "projects"("responsible_department_id", "status");
CREATE INDEX "projects_leader_status_idx" ON "projects"("leader_profile_id", "status");
CREATE INDEX "projects_archived_idx" ON "projects"("archived_at");
CREATE INDEX "project_stages_project_order_idx" ON "project_stages"("project_id", "sort_order");
CREATE UNIQUE INDEX "project_participants_project_person_unique" ON "project_participants"("project_id", "person_id");
CREATE INDEX "project_participants_person_status_idx" ON "project_participants"("person_id", "status");
CREATE INDEX "project_participants_project_status_idx" ON "project_participants"("project_id", "status");
CREATE UNIQUE INDEX "project_documents_object_key_key" ON "project_documents"("object_key");
CREATE INDEX "project_documents_project_status_idx" ON "project_documents"("project_id", "status", "created_at");

ALTER TABLE "projects" ADD CONSTRAINT "projects_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_responsible_department_id_fkey" FOREIGN KEY ("responsible_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_leader_profile_id_fkey" FOREIGN KEY ("leader_profile_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_public_project_id_fkey" FOREIGN KEY ("public_project_id") REFERENCES "public_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_results" ADD CONSTRAINT "project_results_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "person_activities" DROP CONSTRAINT "person_activities_type_check";
ALTER TABLE "person_activities" ALTER COLUMN "event_id" DROP NOT NULL;
ALTER TABLE "person_activities" ALTER COLUMN "registration_id" DROP NOT NULL;
ALTER TABLE "person_activities" ADD COLUMN "project_id" TEXT;
ALTER TABLE "person_activities" ADD COLUMN "project_participant_id" TEXT;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_type_check" CHECK ("activity_type" IN ('EVENT_PARTICIPATION', 'PROJECT_PARTICIPATION'));
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_source_check" CHECK (
  ("activity_type" = 'EVENT_PARTICIPATION' AND "event_id" IS NOT NULL AND "registration_id" IS NOT NULL AND "project_id" IS NULL AND "project_participant_id" IS NULL) OR
  ("activity_type" = 'PROJECT_PARTICIPATION' AND "event_id" IS NULL AND "registration_id" IS NULL AND "project_id" IS NOT NULL AND "project_participant_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "person_activities_project_participant_id_key" ON "person_activities"("project_participant_id");
CREATE UNIQUE INDEX "person_activities_project_person_type_unique" ON "person_activities"("project_id", "person_id", "activity_type");
CREATE INDEX "person_activities_project_status_idx" ON "person_activities"("project_id", "status");
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_project_participant_id_fkey" FOREIGN KEY ("project_participant_id") REFERENCES "project_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_project_history_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Project, stage, participant, result, and document history cannot be physically deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_project_delete_trigger BEFORE DELETE ON "projects" FOR EACH ROW EXECUTE FUNCTION prevent_project_history_delete();
CREATE TRIGGER prevent_project_stage_delete_trigger BEFORE DELETE ON "project_stages" FOR EACH ROW EXECUTE FUNCTION prevent_project_history_delete();
CREATE TRIGGER prevent_project_participant_delete_trigger BEFORE DELETE ON "project_participants" FOR EACH ROW EXECUTE FUNCTION prevent_project_history_delete();
CREATE TRIGGER prevent_project_result_delete_trigger BEFORE DELETE ON "project_results" FOR EACH ROW EXECUTE FUNCTION prevent_project_history_delete();
CREATE TRIGGER prevent_project_document_delete_trigger BEFORE DELETE ON "project_documents" FOR EACH ROW EXECUTE FUNCTION prevent_project_history_delete();

INSERT INTO "roles" ("id", "slug", "name_kk", "access_level", "description", "created_at") VALUES
  ('role-branch-project-manager', 'branch_project_manager', 'Филиал жобалары үйлестірушісі', 'C', 'Тек берілген филиалдың жобаларын басқарады', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-projects-read', 'projects.read', 'Жобаларды өз scope шегінде көру', CURRENT_TIMESTAMP),
  ('permission-projects-manage-global', 'projects.manage_global', 'Республикалық жобаларды басқару', CURRENT_TIMESTAMP),
  ('permission-projects-manage-branch', 'projects.manage_branch', 'Филиал жобаларын өз scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-projects-manage-department', 'projects.manage_department', 'Жауапты департамент жобаларын өз scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-projects-participants-manage', 'projects.participants.manage', 'Жоба қатысушыларын өз scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-projects-stages-manage', 'projects.stages.manage', 'Жоба кезеңдерін өз scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-projects-documents-manage', 'projects.documents.manage', 'Жоба құжаттарын өз scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-projects-results-manage', 'projects.results.manage', 'Жоба нәтижесін өз scope шегінде басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r."slug" || '-' || p."slug", r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE (
  r."slug" IN ('president', 'vice_president_2')
  OR (r."slug" IN ('branch_director', 'branch_project_manager') AND p."slug" IN ('projects.read', 'projects.manage_branch', 'projects.participants.manage', 'projects.stages.manage', 'projects.documents.manage', 'projects.results.manage'))
  OR (r."slug" = 'department_head' AND p."slug" IN ('projects.read', 'projects.manage_department', 'projects.participants.manage', 'projects.stages.manage', 'projects.documents.manage', 'projects.results.manage'))
)
AND p."slug" LIKE 'projects.%'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" ("id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at") VALUES (
  'audit-project-management-20260902',
  'platform.project_management_installed',
  'platform_schema',
  'project-management',
  '{"scopedProjects":true,"stages":true,"participants":true,"results":true,"privateDocuments":true,"profileActivity":true,"publicCmsLink":true}',
  'Ішкі жобаларды толық басқару модулі енгізілді',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
