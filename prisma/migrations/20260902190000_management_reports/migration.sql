INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-reports-read', 'reports.read', 'Рұқсат етілген scope шегіндегі басқару есептерін көру', CURRENT_TIMESTAMP),
  ('permission-reports-export', 'reports.export', 'Рұқсат етілген scope шегіндегі есептерді Excel және PDF түрінде шығару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r.slug || '-' || p.id, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug IN ('president', 'vice_president_2', 'branch_director', 'branch_staff')
  AND p.slug IN ('reports.read', 'reports.export')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
