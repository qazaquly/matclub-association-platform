-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "region_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "director_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "full_name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "region_code" TEXT NOT NULL,
    "city_district" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workplace" TEXT,
    "position" TEXT,
    "education" TEXT,
    "professional_experience" TEXT,
    "math_specialization" TEXT,
    "achievements" TEXT,
    "biography" TEXT,
    "membership_status" TEXT NOT NULL DEFAULT 'registered_user',
    "membership_started_at" TIMESTAMP(3),
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "person_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_kk" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'global',
    "scope_id" TEXT,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_staff" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "staff_type" TEXT NOT NULL,
    "active_from" TIMESTAMP(3) NOT NULL,
    "active_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_applications" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_review',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "decision_reason" TEXT,
    "terms_version" TEXT NOT NULL,
    "terms_accepted_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "membership_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_status_history" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "application_id" TEXT,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "reason" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_documents" (
    "id" TEXT NOT NULL,
    "owner_person_id" TEXT NOT NULL,
    "application_id" TEXT,
    "uploaded_by" TEXT,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'reviewers',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_objects" (
    "object_key" TEXT NOT NULL,
    "body" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_objects_pkey" PRIMARY KEY ("object_key")
);

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" TEXT NOT NULL,
    "person_id" TEXT,
    "application_id" TEXT,
    "branch_id" TEXT,
    "author_user_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'central',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action_type" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_field_definitions" (
    "id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "label_kk" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configuration_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_field_values" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "field_definition_id" TEXT NOT NULL,
    "value_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_region_code_key" ON "branches"("region_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "person_profiles_user_id_key" ON "person_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_profiles_email_key" ON "person_profiles"("email");

-- CreateIndex
CREATE INDEX "person_profiles_branch_idx" ON "person_profiles"("branch_id");

-- CreateIndex
CREATE INDEX "person_profiles_membership_status_idx" ON "person_profiles"("membership_status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_unique" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_user_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_staff_active_unique" ON "branch_staff"("branch_id", "user_id");

-- CreateIndex
CREATE INDEX "membership_applications_branch_idx" ON "membership_applications"("branch_id");

-- CreateIndex
CREATE INDEX "membership_applications_status_idx" ON "membership_applications"("status");

-- CreateIndex
CREATE INDEX "membership_status_history_person_idx" ON "membership_status_history"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_documents_object_key_key" ON "uploaded_documents"("object_key");

-- CreateIndex
CREATE INDEX "internal_notes_application_idx" ON "internal_notes"("application_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_idx" ON "audit_logs"("target_entity", "target_entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_field_definitions_field_key_key" ON "application_field_definitions"("field_key");

-- CreateIndex
CREATE UNIQUE INDEX "application_field_values_unique" ON "application_field_values"("application_id", "field_definition_id");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_director_profile_id_fkey" FOREIGN KEY ("director_profile_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff" ADD CONSTRAINT "branch_staff_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff" ADD CONSTRAINT "branch_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_status_history" ADD CONSTRAINT "membership_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_owner_person_id_fkey" FOREIGN KEY ("owner_person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_field_values" ADD CONSTRAINT "application_field_values_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_field_values" ADD CONSTRAINT "application_field_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "application_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit history is append-only at the PostgreSQL layer. This covers direct SQL,
-- Prisma, and any future application adapter that uses the same database role.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

CREATE TRIGGER prevent_audit_log_update_or_delete
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION reject_audit_log_mutation();

CREATE TRIGGER prevent_audit_log_truncate
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT
EXECUTE FUNCTION reject_audit_log_mutation();


