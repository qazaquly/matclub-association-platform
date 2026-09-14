-- Archive retention: purge only explicitly disposable public CMS data after 60 days.
-- Membership profiles, applications, decisions, attendance history, and audit history are untouched.
ALTER TABLE "public_media" ADD COLUMN "purge_started_at" timestamp(3);

ALTER TABLE "public_media" DROP CONSTRAINT "public_media_status_check";
ALTER TABLE "public_media" ADD CONSTRAINT "public_media_status_check"
  CHECK ("status" IN ('active', 'archived', 'purging'));

CREATE INDEX "public_media_status_archived_idx" ON "public_media"("status", "archived_at");
CREATE INDEX "news_status_archived_idx" ON "news"("status", "archived_at");
CREATE INDEX "publications_status_archived_idx" ON "publications"("status", "archived_at");
CREATE INDEX "public_projects_status_archived_idx" ON "public_projects"("status", "archived_at");

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-archive-retention-policy-20260901',
  'retention.policy_installed',
  'retention_policy',
  'public-cms-60-days',
  '{"retentionDays":60,"news":"archived","drafts":"archived_never_published","unusedPublicMedia":"archived_unreferenced","protected":["person_profiles","membership_applications","membership_status_history","audit_logs"]}',
  'Install the approved 60-day archive retention policy without deleting membership or audit history',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
