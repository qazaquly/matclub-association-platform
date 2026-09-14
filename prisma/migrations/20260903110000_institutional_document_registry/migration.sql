CREATE TABLE "institutional_documents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_date" DATE NOT NULL,
  "document_type" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL DEFAULT 'NATIONAL',
  "branch_id" TEXT,
  "responsible_department_id" TEXT,
  "access_level" TEXT NOT NULL DEFAULT 'RESPONSIBLE',
  "summary" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "institutional_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "institutional_documents_scope_check" CHECK (
    ("scope_type" = 'NATIONAL' AND "branch_id" IS NULL) OR
    ("scope_type" = 'BRANCH' AND "branch_id" IS NOT NULL)
  ),
  CONSTRAINT "institutional_documents_access_check" CHECK ("access_level" IN ('LEADERSHIP', 'RESPONSIBLE', 'MEMBERS')),
  CONSTRAINT "institutional_documents_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED'))
);

CREATE TABLE "institutional_document_versions" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "object_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "change_note" TEXT,
  "uploaded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "institutional_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "institutional_document_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "institutional_document_versions_size_check" CHECK ("size_bytes" > 0)
);

CREATE UNIQUE INDEX "institutional_documents_number_date_type_unique" ON "institutional_documents"("document_number", "document_date", "document_type");
CREATE INDEX "institutional_documents_status_date_idx" ON "institutional_documents"("status", "document_date");
CREATE INDEX "institutional_documents_branch_status_idx" ON "institutional_documents"("branch_id", "status");
CREATE INDEX "institutional_documents_department_status_idx" ON "institutional_documents"("responsible_department_id", "status");
CREATE UNIQUE INDEX "institutional_document_versions_object_key_key" ON "institutional_document_versions"("object_key");
CREATE UNIQUE INDEX "institutional_document_versions_document_version_unique" ON "institutional_document_versions"("document_id", "version_number");
CREATE INDEX "institutional_document_versions_document_date_idx" ON "institutional_document_versions"("document_id", "created_at");

ALTER TABLE "institutional_documents" ADD CONSTRAINT "institutional_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_documents" ADD CONSTRAINT "institutional_documents_responsible_department_id_fkey" FOREIGN KEY ("responsible_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_documents" ADD CONSTRAINT "institutional_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_documents" ADD CONSTRAINT "institutional_documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_document_versions" ADD CONSTRAINT "institutional_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "institutional_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institutional_document_versions" ADD CONSTRAINT "institutional_document_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_institutional_document_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'institutional documents are permanent; archive instead';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_institutional_document_version_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'institutional document versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institutional_documents_no_delete
BEFORE DELETE OR TRUNCATE ON "institutional_documents"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_institutional_document_delete();

CREATE TRIGGER institutional_document_versions_no_update_delete
BEFORE UPDATE OR DELETE OR TRUNCATE ON "institutional_document_versions"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_institutional_document_version_mutation();

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-institutional-documents-read', 'institutional_documents.read', 'Қолжетімділік деңгейі мен scope шегіндегі ішкі ресми құжаттарды көру', CURRENT_TIMESTAMP),
  ('permission-institutional-documents-manage-global', 'institutional_documents.manage_global', 'Барлық ішкі ресми құжатты басқару', CURRENT_TIMESTAMP),
  ('permission-institutional-documents-manage-branch', 'institutional_documents.manage_branch', 'Өз филиалының ішкі ресми құжаттарын басқару', CURRENT_TIMESTAMP),
  ('permission-institutional-documents-manage-department', 'institutional_documents.manage_department', 'Өз департаментінің ішкі ресми құжаттарын басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r.slug || '-' || p.id, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE (
  (r.slug IN ('president', 'vice_president_2') AND p.slug IN (
    'institutional_documents.read',
    'institutional_documents.manage_global',
    'institutional_documents.manage_branch',
    'institutional_documents.manage_department'
  )) OR
  (r.slug = 'branch_director' AND p.slug IN ('institutional_documents.read', 'institutional_documents.manage_branch')) OR
  (r.slug IN ('branch_staff', 'department_staff', 'vice_president_1', 'member') AND p.slug = 'institutional_documents.read') OR
  (r.slug = 'department_head' AND p.slug IN ('institutional_documents.read', 'institutional_documents.manage_department'))
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
