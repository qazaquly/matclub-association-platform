CREATE TABLE "membership_application_drafts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "full_name" TEXT,
  "birth_year" INTEGER,
  "region_code" TEXT,
  "city_district" TEXT,
  "phone" TEXT,
  "workplace" TEXT,
  "position" TEXT,
  "education" TEXT,
  "professional_experience" TEXT,
  "math_specialization" TEXT,
  "achievements" TEXT,
  "biography" TEXT,
  "source" TEXT NOT NULL DEFAULT 'web',
  "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submitted_application_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_application_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "membership_application_drafts_status_check" CHECK ("status" IN ('draft', 'submitting', 'submitted'))
);

ALTER TABLE "uploaded_documents" ADD COLUMN "draft_id" TEXT;

CREATE UNIQUE INDEX "membership_application_drafts_user_id_key" ON "membership_application_drafts"("user_id");
CREATE UNIQUE INDEX "membership_application_drafts_person_id_key" ON "membership_application_drafts"("person_id");
CREATE UNIQUE INDEX "membership_application_drafts_submitted_application_id_key" ON "membership_application_drafts"("submitted_application_id");
CREATE INDEX "membership_application_drafts_status_updated_idx" ON "membership_application_drafts"("status", "updated_at");
CREATE INDEX "uploaded_documents_draft_id_idx" ON "uploaded_documents"("draft_id");
CREATE UNIQUE INDEX "membership_applications_one_active_per_person_idx"
  ON "membership_applications"("person_id")
  WHERE "archived_at" IS NULL AND "status" IN ('awaiting_review', 'reserve');

ALTER TABLE "membership_application_drafts" ADD CONSTRAINT "membership_application_drafts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membership_application_drafts" ADD CONSTRAINT "membership_application_drafts_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "membership_application_drafts" ADD CONSTRAINT "membership_application_drafts_submitted_application_id_fkey"
  FOREIGN KEY ("submitted_application_id") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_draft_id_fkey"
  FOREIGN KEY ("draft_id") REFERENCES "membership_application_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-schema-membership-application-drafts-20260817',
  'schema.model_added',
  'database_schema',
  'membership_application_drafts',
  '{"models":["membership_application_drafts"],"uploadedDocumentDraftLink":true,"activeApplicationUniqueness":true}',
  'Мүшелік өтінішінің серверлік draft моделі енгізілді',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
