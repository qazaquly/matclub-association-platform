-- Full global administration belongs only to the President and Vice-President II.
-- Preserve any legacy assignment details in the immutable audit ledger before
-- removing the unsupported role and its relational records.
INSERT INTO "audit_logs" (
  "id",
  "action_type",
  "target_entity",
  "target_entity_id",
  "previous_value",
  "new_value",
  "reason",
  "created_at"
)
SELECT
  'audit-remove-super-admin-role-20260831',
  'access_governance.unsupported_role_removed',
  'role',
  r."id",
  json_build_object(
    'slug', r."slug",
    'nameKk', r."name_kk",
    'assignments', COALESCE((
      SELECT json_agg(json_build_object(
        'id', ur."id",
        'userId', ur."user_id",
        'scopeType', ur."scope_type",
        'scopeId', ur."scope_id",
        'grantedAt', ur."granted_at",
        'revokedAt', ur."revoked_at"
      ) ORDER BY ur."granted_at")
      FROM "user_roles" ur
      WHERE ur."role_id" = r."id"
    ), '[]'::json)
  )::text,
  '{"removed":true,"fullGlobalRoles":["president","vice_president_2"]}',
  'Only the President and Vice-President II may hold full global administration',
  CURRENT_TIMESTAMP
FROM "roles" r
WHERE r."slug" = 'super_admin'
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "user_roles"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "slug" = 'super_admin');

DELETE FROM "role_permissions"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "slug" = 'super_admin');

DELETE FROM "roles" WHERE "slug" = 'super_admin';
