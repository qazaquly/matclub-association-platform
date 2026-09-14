-- Structured, non-executable public content. Layout and application code remain in source.
CREATE TABLE "public_content" (
  "key" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "value_type" TEXT NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_content_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "public_content_section_idx" ON "public_content"("section");

ALTER TABLE "public_content"
  ADD CONSTRAINT "public_content_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A dedicated capability can later be granted to a communications role without
-- granting global administration. Phase 1 grants it only to the approved full-access roles.
INSERT INTO "permissions" ("id", "slug", "description", "created_at")
VALUES ('permission-public-content-manage', 'public_content.manage', 'Ашық сайт мазмұнын басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r.slug || '-permission-public-content-manage', r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug IN ('president', 'vice_president_2', 'super_admin')
  AND p.slug = 'public_content.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "public_content" ("key", "section", "value", "value_type") VALUES
  ('home.hero.headline', 'Басты бет · кіріспе', 'Қазақстанның кәсіби математикалық қауымдастығы', 'text'),
  ('home.hero.slogan', 'Басты бет · кіріспе', 'Математика — ортақ тіл. Бірлестік — ортақ күш.', 'text'),
  ('home.hero.intro', 'Басты бет · кіріспе', 'Ғалымдарды, оқытушыларды және математикалық ойлауды дамытатын мамандарды бір институционалдық кеңістікке біріктіреміз.', 'textarea'),
  ('home.hero.primaryLabel', 'Басты бет · кіріспе', 'Бірлестікке мүше болу', 'text'),
  ('home.hero.primaryDestination', 'Басты бет · кіріспе', '/membership', 'destination'),
  ('home.hero.secondaryLabel', 'Басты бет · кіріспе', 'Бірлестік туралы', 'text'),
  ('home.hero.secondaryDestination', 'Басты бет · кіріспе', '/about', 'destination'),
  ('home.about.heading', 'Басты бет · Бірлестік туралы', 'Математиктерді бүгін біріктіріп, ертеңге мұра қалдырамыз.', 'textarea'),
  ('home.about.intro', 'Басты бет · Бірлестік туралы', 'Бірлестік кәсіби байланысты күшейтеді, өңірлік бастамаларды қолдайды және математикалық қоғамның ұзақ мерзімді институционалдық жадын қалыптастырады.', 'textarea'),
  ('home.structure.heading', 'Басты бет · Құрылым', 'Ортақ мақсат. Айқын жауапкершілік.', 'textarea'),
  ('home.structure.intro', 'Басты бет · Құрылым', 'Президент, вице-президенттер, кәсіби департаменттер және өңірлік филиалдар бір басқару архитектурасында жұмыс істейді.', 'textarea'),
  ('home.structure.ctaLabel', 'Басты бет · Құрылым', 'Ұйымдық құрылымды көру', 'text'),
  ('home.structure.ctaDestination', 'Басты бет · Құрылым', '/structure', 'destination'),
  ('home.projects.heading', 'Басты бет · Жобалар', 'Бірлестік күн тәртібі', 'text'),
  ('home.projects.ctaLabel', 'Басты бет · Жобалар', 'Барлық жобалар', 'text'),
  ('home.projects.ctaDestination', 'Басты бет · Жобалар', '/projects', 'destination'),
  ('home.membership.heading', 'Басты бет · Мүшелік', 'Кәсіби ортаға үлес қосатын кез келді.', 'textarea'),
  ('home.membership.intro', 'Басты бет · Мүшелік', 'Өтінішті онлайн жіберіңіз. Ол сіздің өңіріңіздегі филиалға автоматты түрде бағытталады.', 'textarea'),
  ('home.membership.ctaLabel', 'Басты бет · Мүшелік', 'Өтініш беру', 'text'),
  ('home.membership.ctaDestination', 'Басты бет · Мүшелік', '/membership', 'destination'),
  ('page.about.lead', 'Ашық беттер', 'Республикалық математиктер бірлестігі мамандарды, өңірлерді және кәсіби бастамаларды ұзақ мерзімді негізде біріктіреді.', 'textarea'),
  ('page.structure.lead', 'Ашық беттер', 'Бірлестік республикалық басқару, кәсіби департаменттер және өңірлік филиалдар қағидатымен құрылады.', 'textarea'),
  ('page.branches.lead', 'Ашық беттер', 'Филиалдар өз өңіріндегі мүшелік өтініштерге, кәсіби байланысқа және бірлестік жұмысына жауап береді.', 'textarea'),
  ('page.projects.lead', 'Ашық беттер', 'Phase 1 жобалар мен бастамалардың ашық құрылымын ұсынады. Толық жобалық басқару кейінгі кезеңдерге жоспарланған.', 'textarea'),
  ('page.news.lead', 'Ашық беттер', 'Республикалық басқару, департаменттер және өңірлік филиалдардан келетін ресми жаңалықтарға арналған бөлім.', 'textarea'),
  ('common.cta.eyebrow', 'Ашық беттер · ортақ шақыру', 'Бірлестік мүшесі болыңыз', 'text'),
  ('common.cta.heading', 'Ашық беттер · ортақ шақыру', 'Ортақ кәсіби кеңістікке қосылыңыз.', 'text'),
  ('common.cta.label', 'Ашық беттер · ортақ шақыру', 'Өтініш беру', 'text'),
  ('common.cta.destination', 'Ашық беттер · ортақ шақыру', '/membership', 'destination'),
  ('footer.description', 'Төменгі бөлік және байланыс', 'Қазақстан математиктерін біріктіретін заманауи институционалдық кеңістік.', 'textarea'),
  ('footer.contactLabel', 'Төменгі бөлік және байланыс', 'Хабарласу', 'text'),
  ('footer.contactDestination', 'Төменгі бөлік және байланыс', '/contact', 'destination')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
)
VALUES (
  'audit-public-content-model-20260814',
  'public_content.model_added',
  'public_content',
  'phase-one',
  '{"capability":"public_content.manage","format":"structured_plain_text"}',
  'Phase 1 production correction',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
