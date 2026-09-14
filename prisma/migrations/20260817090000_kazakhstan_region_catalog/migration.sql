-- Complete regional catalog required by the membership application workflow.
WITH catalog (id, name, region_code, region_name) AS (
  VALUES
    ('branch-astana', 'Астана қалалық филиалы', 'astana', 'Астана қаласы'),
    ('branch-almaty', 'Алматы қалалық филиалы', 'almaty', 'Алматы қаласы'),
    ('branch-shymkent', 'Шымкент қаласы', 'shymkent', 'Шымкент қаласы'),
    ('branch-abai', 'Абай облысы', 'abai', 'Абай облысы'),
    ('branch-akmola', 'Ақмола облысы', 'akmola', 'Ақмола облысы'),
    ('branch-aktobe', 'Ақтөбе облысы', 'aktobe', 'Ақтөбе облысы'),
    ('branch-almaty-oblysy', 'Алматы облысы', 'almaty-oblysy', 'Алматы облысы'),
    ('branch-atyrau', 'Атырау облысы', 'atyrau', 'Атырау облысы'),
    ('branch-batys-qazaqstan', 'Батыс Қазақстан облысы', 'batys-qazaqstan', 'Батыс Қазақстан облысы'),
    ('branch-zhambyl', 'Жамбыл облысы', 'zhambyl', 'Жамбыл облысы'),
    ('branch-zhetisu', 'Жетісу облысы', 'zhetisu', 'Жетісу облысы'),
    ('branch-karaganda', 'Қарағанды облыстық филиалы', 'karaganda', 'Қарағанды облысы'),
    ('branch-kostanay', 'Қостанай облысы', 'kostanay', 'Қостанай облысы'),
    ('branch-kyzylorda', 'Қызылорда облысы', 'kyzylorda', 'Қызылорда облысы'),
    ('branch-mangystau', 'Маңғыстау облысы', 'mangystau', 'Маңғыстау облысы'),
    ('branch-pavlodar', 'Павлодар облысы', 'pavlodar', 'Павлодар облысы'),
    ('branch-soltustik-qazaqstan', 'Солтүстік Қазақстан облысы', 'soltustik-qazaqstan', 'Солтүстік Қазақстан облысы'),
    ('branch-turkistan', 'Түркістан облыстық филиалы', 'turkistan', 'Түркістан облысы'),
    ('branch-ulytau', 'Ұлытау облысы', 'ulytau', 'Ұлытау облысы'),
    ('branch-east', 'Шығыс Қазақстан облыстық филиалы', 'east', 'Шығыс Қазақстан облысы')
), synchronized AS (
  INSERT INTO "branches" ("id", "name", "region_code", "region_name", "status", "created_at", "updated_at")
  SELECT id, name, region_code, region_name, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM catalog
  ON CONFLICT ("region_code") DO UPDATE SET
    "region_name" = EXCLUDED."region_name",
    "updated_at" = EXCLUDED."updated_at"
  WHERE "branches"."region_name" IS DISTINCT FROM EXCLUDED."region_name"
  RETURNING "id"
)
INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
)
SELECT
  'audit-region-catalog-20260817',
  'branch_catalog.regions_synchronized',
  'branch_catalog',
  'kazakhstan-regions',
  '{"regionCount":20}',
  'Мүшелік өтінішіне арналған өңірлер каталогы енгізілді',
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM synchronized)
ON CONFLICT ("id") DO NOTHING;
