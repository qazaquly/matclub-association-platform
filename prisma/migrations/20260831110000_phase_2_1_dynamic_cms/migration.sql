-- Phase 2.1: dynamic public CMS. Fixed PublicContent fields remain unchanged.
CREATE TABLE "public_media" (
  "id" text NOT NULL,
  "object_key" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "uploaded_by" text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" timestamp(3),
  CONSTRAINT "public_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "public_media_object_key_key" UNIQUE ("object_key"),
  CONSTRAINT "public_media_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "public_media_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608),
  CONSTRAINT "public_media_uploader_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public_objects" (
  "object_key" text NOT NULL,
  "body" bytea NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,
  CONSTRAINT "public_objects_pkey" PRIMARY KEY ("object_key")
);

CREATE TABLE "news" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "lead" text NOT NULL,
  "body" text NOT NULL,
  "body_format" text NOT NULL DEFAULT 'restricted_markdown',
  "cover_media_id" text,
  "author_text" text,
  "author_profile_id" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "published_at" timestamp(3),
  "archived_at" timestamp(3),
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,
  CONSTRAINT "news_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_slug_key" UNIQUE ("slug"),
  CONSTRAINT "news_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "news_body_format_check" CHECK ("body_format" = 'restricted_markdown'),
  CONSTRAINT "news_cover_media_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "public_media"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "news_author_profile_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "news_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "news_updater_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "publications" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "summary" text NOT NULL,
  "body" text NOT NULL,
  "body_format" text NOT NULL DEFAULT 'restricted_markdown',
  "cover_media_id" text,
  "author_text" text,
  "author_profile_id" text,
  "publication_date" date,
  "resource_url" text,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "published_at" timestamp(3),
  "archived_at" timestamp(3),
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,
  CONSTRAINT "publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publications_slug_key" UNIQUE ("slug"),
  CONSTRAINT "publications_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "publications_body_format_check" CHECK ("body_format" = 'restricted_markdown'),
  CONSTRAINT "publications_cover_media_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "public_media"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "publications_author_profile_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "publications_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "publications_updater_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "partners" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "website_url" text,
  "logo_media_id" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,
  CONSTRAINT "partners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partners_status_check" CHECK ("status" IN ('active', 'inactive')),
  CONSTRAINT "partners_logo_media_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "public_media"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "partners_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "partners_updater_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "public_projects" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "summary" text NOT NULL,
  "body" text NOT NULL,
  "body_format" text NOT NULL DEFAULT 'restricted_markdown',
  "cover_media_id" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "public_start_date" date,
  "public_end_date" date,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "published_at" timestamp(3),
  "archived_at" timestamp(3),
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL,
  CONSTRAINT "public_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "public_projects_slug_key" UNIQUE ("slug"),
  CONSTRAINT "public_projects_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "public_projects_body_format_check" CHECK ("body_format" = 'restricted_markdown'),
  CONSTRAINT "public_projects_dates_check" CHECK ("public_end_date" IS NULL OR "public_start_date" IS NULL OR "public_end_date" >= "public_start_date"),
  CONSTRAINT "public_projects_cover_media_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "public_media"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "public_projects_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "public_projects_updater_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "public_media_status_created_idx" ON "public_media"("status", "created_at");
CREATE INDEX "news_publication_idx" ON "news"("status", "published_at");
CREATE INDEX "news_created_idx" ON "news"("created_at");
CREATE INDEX "publications_publication_idx" ON "publications"("status", "published_at");
CREATE INDEX "publications_date_idx" ON "publications"("publication_date");
CREATE INDEX "partners_public_idx" ON "partners"("status", "display_order");
CREATE INDEX "public_projects_public_idx" ON "public_projects"("status", "display_order", "published_at");

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-dynamic-content-manage', 'dynamic_content.manage', 'Динамикалық ашық мазмұнды құру және өңдеу', CURRENT_TIMESTAMP),
  ('permission-dynamic-content-publish', 'dynamic_content.publish', 'Динамикалық ашық мазмұнды жариялау және архивтеу', CURRENT_TIMESTAMP),
  ('permission-public-media-manage', 'public_media.manage', 'Ашық сайт суреттерін басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'phase-2-1-' || r.slug || '-' || p.slug, r.id, p.id, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.slug IN ('president', 'vice_president_2')
  AND p.slug IN ('dynamic_content.manage', 'dynamic_content.publish', 'public_media.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-phase-2-1-dynamic-cms-20260831',
  'dynamic_content.schema_installed',
  'dynamic_content',
  'phase-2-1',
  '{"types":["news","publications","partners","public_projects"],"format":"restricted_markdown","publicMediaSeparate":true,"capabilityGated":true}',
  'Install Phase 2.1 dynamic public CMS without replacing fixed Phase 1 content',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
