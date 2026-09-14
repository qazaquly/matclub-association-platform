-- Phase 2.2: permanent Event records, structured results, and explicit Event-News links.

CREATE TABLE "events" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "body_format" TEXT NOT NULL DEFAULT 'restricted_markdown',
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "event_scope" TEXT NOT NULL,
  "branch_id" TEXT,
  "region_name" TEXT,
  "venue" TEXT,
  "event_format" TEXT NOT NULL,
  "online_url" TEXT,
  "audience" TEXT NOT NULL,
  "cover_media_id" TEXT,
  "organizer" TEXT NOT NULL,
  "responsible_profile_id" TEXT,
  "responsible_department_id" TEXT,
  "registration_mode" TEXT NOT NULL DEFAULT 'NONE',
  "external_registration_url" TEXT,
  "participant_limit" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "status_note" TEXT,
  "submitted_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "postponed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "events_dates_check" CHECK ("end_at" >= "start_at"),
  CONSTRAINT "events_scope_check" CHECK (
    ("event_scope" = 'NATIONAL' AND "branch_id" IS NULL) OR
    ("event_scope" = 'BRANCH' AND "branch_id" IS NOT NULL)
  ),
  CONSTRAINT "events_format_check" CHECK ("event_format" IN ('OFFLINE', 'ONLINE', 'HYBRID')),
  CONSTRAINT "events_registration_mode_check" CHECK ("registration_mode" IN ('NONE', 'EXTERNAL_LINK', 'INTERNAL_MEMBERS')),
  CONSTRAINT "events_status_check" CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED', 'ARCHIVED')),
  CONSTRAINT "events_participant_limit_check" CHECK ("participant_limit" IS NULL OR "participant_limit" > 0)
);

CREATE TABLE "event_results" (
  "event_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "participant_count" INTEGER,
  "audience_description" TEXT,
  "main_topics" TEXT,
  "outcomes" TEXT,
  "decisions" TEXT,
  "speakers" TEXT,
  "notes" TEXT,
  "material_references" TEXT,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_results_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "event_results_participant_count_check" CHECK ("participant_count" IS NULL OR "participant_count" >= 0)
);

CREATE TABLE "event_news_links" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "news_id" TEXT NOT NULL,
  "relation_type" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_news_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_news_links_relation_type_check" CHECK ("relation_type" IN ('EVENT_ANNOUNCEMENT', 'EVENT_RESULT'))
);

CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
CREATE INDEX "events_publication_start_idx" ON "events"("status", "start_at");
CREATE INDEX "events_branch_status_start_idx" ON "events"("branch_id", "status", "start_at");
CREATE INDEX "events_scope_status_idx" ON "events"("event_scope", "status");
CREATE INDEX "events_archived_idx" ON "events"("archived_at");
CREATE UNIQUE INDEX "event_news_links_news_id_key" ON "event_news_links"("news_id");
CREATE UNIQUE INDEX "event_news_links_type_unique" ON "event_news_links"("event_id", "relation_type");
CREATE INDEX "event_news_links_event_idx" ON "event_news_links"("event_id");

ALTER TABLE "events" ADD CONSTRAINT "events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "public_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_responsible_profile_id_fkey" FOREIGN KEY ("responsible_profile_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_responsible_department_id_fkey" FOREIGN KEY ("responsible_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_results" ADD CONSTRAINT "event_results_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_news_links" ADD CONSTRAINT "event_news_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_news_links" ADD CONSTRAINT "event_news_links_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_news_links" ADD CONSTRAINT "event_news_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_historical_event_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD."published_at" IS NOT NULL OR OLD."status" IN ('PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'Published or historical events cannot be physically deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_historical_event_delete_trigger
BEFORE DELETE ON "events"
FOR EACH ROW EXECUTE FUNCTION prevent_historical_event_delete();

INSERT INTO "roles" ("id", "slug", "name_kk", "access_level", "description", "created_at")
VALUES ('role-branch-event-manager', 'branch_event_manager', 'Филиал іс-шаралары үйлестірушісі', 'C', 'Тек берілген филиалдың іс-шара жобаларын басқарады', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-events-manage-global', 'events.manage_global', 'Барлық іс-шараны құру және өңдеу', CURRENT_TIMESTAMP),
  ('permission-events-manage-branch', 'events.manage_branch', 'Берілген филиалдың іс-шара жобаларын құру және өңдеу', CURRENT_TIMESTAMP),
  ('permission-events-publish', 'events.publish', 'Іс-шараны жариялау және тарихи мәртебесін басқару', CURRENT_TIMESTAMP),
  ('permission-events-results-manage', 'events.results.manage', 'Іс-шараның құрылымдалған қорытындысын басқару', CURRENT_TIMESTAMP),
  ('permission-events-news-generate', 'events.news.generate', 'Іс-шарадан анонс және қорытынды жаңалығының жобасын жасау', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r."slug" || '-' || p."slug", r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE (
  r."slug" IN ('president', 'vice_president_2') AND p."slug" IN (
    'events.manage_global', 'events.manage_branch', 'events.publish', 'events.results.manage', 'events.news.generate'
  )
) OR (
  r."slug" IN ('branch_director', 'branch_event_manager') AND p."slug" IN (
    'events.manage_branch', 'events.results.manage', 'events.news.generate'
  )
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-phase-2-2-event-core-20260901',
  'platform.phase_2_2_event_core_installed',
  'platform_schema',
  'phase-2-2-event-core',
  '{"eventPermanent":true,"eventNewsRelations":["EVENT_ANNOUNCEMENT","EVENT_RESULT"],"branchScopeEnforced":true,"automaticNewsPublication":false}',
  'Phase 2.2 іс-шаралар өзегі, қорытындысы және News байланысы енгізілді',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
