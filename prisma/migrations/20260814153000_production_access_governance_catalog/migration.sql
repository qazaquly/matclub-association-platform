-- Production uses explicit account bootstrap rather than the fictional development seed.
-- Install the approved Phase 1 role/capability catalog without creating any users.
INSERT INTO "roles" ("id", "slug", "name_kk", "access_level", "description", "created_at") VALUES
  ('role-member', 'member', 'Бірлестік мүшесі', 'D', 'Тек өзінің профилі', CURRENT_TIMESTAMP),
  ('role-branch-staff', 'branch_staff', 'Филиал қызметкері', 'C', 'Өз филиалының операциялары', CURRENT_TIMESTAMP),
  ('role-branch-director', 'branch_director', 'Филиал директоры', 'C', 'Өз филиалына жауапты', CURRENT_TIMESTAMP),
  ('role-department-staff', 'department_staff', 'Департамент қызметкері', 'B', 'Кәсіби міндет шегіндегі қолжетімділік', CURRENT_TIMESTAMP),
  ('role-department-head', 'department_head', 'Департамент басшысы', 'B', 'Департамент шегіндегі қолжетімділік', CURRENT_TIMESTAMP),
  ('role-vp1', 'vice_president_1', 'I вице-президент', 'B', 'Математика, мазмұн және кәсіби даму', CURRENT_TIMESTAMP),
  ('role-vp2', 'vice_president_2', 'II вице-президент', 'A', 'Ұйымдық және институционалдық даму', CURRENT_TIMESTAMP),
  ('role-president', 'president', 'Президент', 'A', 'Толық жаһандық қолжетімділік', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-profile-own-read', 'profile.own.read', 'Өз профилін көру', CURRENT_TIMESTAMP),
  ('permission-profile-own-update', 'profile.own.update', 'Рұқсат етілген профиль өрістерін өзгерту', CURRENT_TIMESTAMP),
  ('permission-branch-applications-read', 'applications.branch.read', 'Өз филиалының өтініштерін көру', CURRENT_TIMESTAMP),
  ('permission-branch-applications-decide', 'applications.branch.decide', 'Өз филиалының өтініштеріне шешім шығару', CURRENT_TIMESTAMP),
  ('permission-branch-documents-read', 'documents.branch.read', 'Өз филиалының өтініш құжаттарын көру', CURRENT_TIMESTAMP),
  ('permission-branch-members-read', 'members.branch.read', 'Өз филиалының мүшелерін көру', CURRENT_TIMESTAMP),
  ('permission-department-professional-read', 'department.professional.read', 'Қажетті кәсіби деректерді көру', CURRENT_TIMESTAMP),
  ('permission-all-read', 'all.read', 'Барлық институционалдық деректі көру', CURRENT_TIMESTAMP),
  ('permission-all-write', 'all.write', 'Әкімшілік деректерді басқару', CURRENT_TIMESTAMP),
  ('permission-roles-manage', 'roles.manage', 'Рөлдерді басқару', CURRENT_TIMESTAMP),
  ('permission-audit-read', 'audit.read', 'Аудит журналын көру', CURRENT_TIMESTAMP),
  ('permission-branches-manage', 'branches.manage', 'Филиалдарды басқару', CURRENT_TIMESTAMP),
  ('permission-public-content-manage', 'public_content.manage', 'Ашық сайт мазмұнын басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- Member, branch, and professional roles receive only their approved scoped capabilities.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'catalog-' || r.slug || '-' || p.slug, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON
  (r.slug = 'member' AND p.slug IN ('profile.own.read', 'profile.own.update')) OR
  (r.slug IN ('branch_staff', 'branch_director') AND p.slug IN ('applications.branch.read', 'applications.branch.decide', 'documents.branch.read', 'members.branch.read')) OR
  (r.slug IN ('department_staff', 'department_head', 'vice_president_1') AND p.slug = 'department.professional.read')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- President and VP2 intentionally receive identical full-global capability sets.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'catalog-' || r.slug || '-' || p.slug, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug IN ('president', 'vice_president_2')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-production-access-governance-catalog-20260814',
  'access_governance.catalog_installed',
  'access_governance',
  'phase-one',
  '{"roleManagers":["president","vice_president_2"],"fullGlobalRoles":["president","vice_president_2"],"membershipStatusSeparate":true}',
  'Install approved Phase 1 production role and capability catalog without development users',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
