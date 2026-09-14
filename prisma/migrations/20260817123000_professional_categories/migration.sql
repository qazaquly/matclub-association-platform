-- Professional categories are official profile metadata and remain separate
-- from membership status, system access roles, branches, and departments.
CREATE TABLE "professional_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_categories_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE TABLE "person_professional_category_assignments" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "assigned_by" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removed_by" TEXT,
  "removed_at" TIMESTAMP(3),
  CONSTRAINT "person_professional_category_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_categories_name_key"
  ON "professional_categories"("name");
CREATE INDEX "professional_categories_status_sort_idx"
  ON "professional_categories"("status", "sort_order");
CREATE INDEX "person_professional_categories_person_active_idx"
  ON "person_professional_category_assignments"("person_id", "removed_at");
CREATE INDEX "person_professional_categories_category_active_idx"
  ON "person_professional_category_assignments"("category_id", "removed_at");
CREATE UNIQUE INDEX "person_professional_categories_active_unique"
  ON "person_professional_category_assignments"("person_id", "category_id")
  WHERE "removed_at" IS NULL;

ALTER TABLE "person_professional_category_assignments"
  ADD CONSTRAINT "person_professional_category_assignments_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_professional_category_assignments"
  ADD CONSTRAINT "person_professional_category_assignments_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "professional_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_professional_category_assignments"
  ADD CONSTRAINT "person_professional_category_assignments_assigned_by_fkey"
  FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_professional_category_assignments"
  ADD CONSTRAINT "person_professional_category_assignments_removed_by_fkey"
  FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-professional-categories-catalog-manage', 'professional_categories.catalog.manage', 'Кәсіби санаттар каталогын басқару', CURRENT_TIMESTAMP),
  ('permission-professional-categories-assign', 'professional_categories.assign', 'Кәсіби санаттарды профильдерге ресми тағайындау', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r.slug || '-' || p.id, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug IN ('president', 'vice_president_2')
  AND p.slug IN ('professional_categories.catalog.manage', 'professional_categories.assign')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "professional_categories" ("id", "name", "description", "sort_order", "status", "created_at", "updated_at") VALUES
  ('professional-category-mathematician-scientist', 'Математик-ғалым', NULL, 10, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('professional-category-mathematics-teacher', 'Математика мұғалімі', NULL, 20, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('professional-category-olympiad-mathematics', 'Олимпиадалық математика өкілі', NULL, 30, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('professional-category-mathematics-enthusiast', 'Математикаға қызығушылығы бар тұлға', NULL, 40, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-professional-category-model-20260817',
  'professional_category.model_added',
  'professional_category_catalog',
  'phase-one',
  '{"relationship":"many-to-many","separateFromMembershipStatus":true,"initialCategoryCount":4}',
  'Кәсіби санаттардың тұрақты домендік моделі енгізілді',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
