-- Correct the authoritative Phase 1 vice-president access mapping.
UPDATE "roles"
SET "access_level" = 'B',
    "description" = 'Математика, мазмұн және кәсіби даму'
WHERE "id" = 'role-vp1';

UPDATE "roles"
SET "access_level" = 'A',
    "description" = 'Ұйымдық және институционалдық даму'
WHERE "id" = 'role-vp2';

UPDATE "user_roles"
SET "scope_type" = 'department',
    "scope_id" = 'dept-content'
WHERE "role_id" = 'role-vp1'
  AND "revoked_at" IS NULL;

UPDATE "user_roles"
SET "scope_type" = 'global',
    "scope_id" = NULL
WHERE "role_id" = 'role-vp2'
  AND "revoked_at" IS NULL;

DELETE FROM "role_permissions"
WHERE "role_id" IN ('role-vp1', 'role-vp2');

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-vice_president_1-' || "id", 'role-vp1', "id", CURRENT_TIMESTAMP
FROM "permissions"
WHERE "id" = 'permission-department-professional-read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-vice_president_2-' || "id", 'role-vp2', "id", CURRENT_TIMESTAMP
FROM "permissions"
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id",
  "previous_value", "new_value", "reason", "created_at"
)
SELECT
  'audit-vp-access-mapping-20260807',
  'authorization.mapping_corrected',
  'role_mapping',
  'vice_presidents',
  '{"vice_president_1":"full_global","vice_president_2":"department_professional"}',
  '{"vice_president_1":"department_professional","vice_president_2":"full_global"}',
  'Phase 1 authoritative access mapping correction',
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "roles" WHERE "id" IN ('role-vp1', 'role-vp2'))
ON CONFLICT ("id") DO NOTHING;
