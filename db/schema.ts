import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
};

export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    regionCode: text("region_code").notNull(),
    regionName: text("region_name").notNull(),
    status: text("status").notNull().default("active"),
    directorProfileId: text("director_profile_id"),
    ...timestamps,
  },
  (table) => [uniqueIndex("branches_region_code_unique").on(table.regionCode)],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    status: text("status").notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const personProfiles = sqliteTable(
  "person_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    fullName: text("full_name").notNull(),
    birthYear: integer("birth_year"),
    regionCode: text("region_code").notNull(),
    cityDistrict: text("city_district").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    workplace: text("workplace"),
    position: text("position"),
    education: text("education"),
    professionalExperience: text("professional_experience"),
    mathSpecialization: text("math_specialization"),
    achievements: text("achievements"),
    biography: text("biography"),
    membershipStatus: text("membership_status").notNull().default("registered_user"),
    membershipStartedAt: text("membership_started_at"),
    branchId: text("branch_id").references(() => branches.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("person_profiles_user_id_unique").on(table.userId),
    uniqueIndex("person_profiles_email_unique").on(table.email),
    index("person_profiles_branch_idx").on(table.branchId),
    index("person_profiles_membership_status_idx").on(table.membershipStatus),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameKk: text("name_kk").notNull(),
    accessLevel: text("access_level").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("roles_slug_unique").on(table.slug)],
);

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("permissions_slug_unique").on(table.slug)],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: text("id").primaryKey(),
    roleId: text("role_id").notNull().references(() => roles.id),
    permissionId: text("permission_id").notNull().references(() => permissions.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("role_permissions_unique").on(table.roleId, table.permissionId),
  ],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    roleId: text("role_id").notNull().references(() => roles.id),
    scopeType: text("scope_type").notNull().default("global"),
    scopeId: text("scope_id"),
    grantedBy: text("granted_by").references(() => users.id),
    grantedAt: text("granted_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("user_roles_user_idx").on(table.userId)],
);

export const branchStaff = sqliteTable(
  "branch_staff",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").notNull().references(() => branches.id),
    userId: text("user_id").notNull().references(() => users.id),
    staffType: text("staff_type").notNull(),
    activeFrom: text("active_from").notNull(),
    activeTo: text("active_to"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("branch_staff_active_unique").on(table.branchId, table.userId),
  ],
);

export const membershipApplications = sqliteTable(
  "membership_applications",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => personProfiles.id),
    branchId: text("branch_id").notNull().references(() => branches.id),
    status: text("status").notNull().default("awaiting_review"),
    submittedAt: text("submitted_at").notNull(),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    decisionReason: text("decision_reason"),
    termsVersion: text("terms_version").notNull(),
    termsAcceptedAt: text("terms_accepted_at").notNull(),
    source: text("source").notNull().default("web"),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("membership_applications_branch_idx").on(table.branchId),
    index("membership_applications_status_idx").on(table.status),
  ],
);

export const membershipStatusHistory = sqliteTable(
  "membership_status_history",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull().references(() => personProfiles.id),
    applicationId: text("application_id").references(() => membershipApplications.id),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    reason: text("reason"),
    visibility: text("visibility").notNull().default("internal"),
    changedBy: text("changed_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("membership_status_history_person_idx").on(table.personId)],
);

export const uploadedDocuments = sqliteTable(
  "uploaded_documents",
  {
    id: text("id").primaryKey(),
    ownerPersonId: text("owner_person_id").notNull().references(() => personProfiles.id),
    applicationId: text("application_id").references(() => membershipApplications.id),
    uploadedBy: text("uploaded_by").references(() => users.id),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    visibility: text("visibility").notNull().default("reviewers"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("uploaded_documents_object_key_unique").on(table.objectKey)],
);

export const internalNotes = sqliteTable(
  "internal_notes",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").references(() => personProfiles.id),
    applicationId: text("application_id").references(() => membershipApplications.id),
    branchId: text("branch_id").references(() => branches.id),
    authorUserId: text("author_user_id").notNull().references(() => users.id),
    note: text("note").notNull(),
    visibility: text("visibility").notNull().default("central"),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [index("internal_notes_application_idx").on(table.applicationId)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    actionType: text("action_type").notNull(),
    targetEntity: text("target_entity").notNull(),
    targetEntityId: text("target_entity_id").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    sessionId: text("session_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetEntity, table.targetEntityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const applicationFieldDefinitions = sqliteTable(
  "application_field_definitions",
  {
    id: text("id").primaryKey(),
    fieldKey: text("field_key").notNull(),
    labelKk: text("label_kk").notNull(),
    fieldType: text("field_type").notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    configurationJson: text("configuration_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("application_field_definitions_key_unique").on(table.fieldKey)],
);

export const applicationFieldValues = sqliteTable(
  "application_field_values",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id").notNull().references(() => membershipApplications.id),
    fieldDefinitionId: text("field_definition_id").notNull().references(() => applicationFieldDefinitions.id),
    valueText: text("value_text"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("application_field_values_unique").on(
      table.applicationId,
      table.fieldDefinitionId,
    ),
  ],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});
