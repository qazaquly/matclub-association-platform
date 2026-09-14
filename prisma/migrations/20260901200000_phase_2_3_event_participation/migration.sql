-- Phase 2.3: member registration, invited guests, attendance, seating, and profile activity history.

ALTER TABLE "events" ADD COLUMN "seating_type" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "events" ADD CONSTRAINT "events_seating_type_check"
  CHECK ("seating_type" IN ('NONE', 'ROWS', 'TABLES', 'FREE'));

CREATE TABLE "event_seating_units" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "seat_count" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_seating_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_seating_units_seat_count_check" CHECK ("seat_count" BETWEEN 1 AND 200),
  CONSTRAINT "event_seating_units_label_check" CHECK (length(btrim("label")) BETWEEN 1 AND 12)
);

CREATE TABLE "event_registrations" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "participant_type" TEXT NOT NULL DEFAULT 'MEMBER',
  "person_id" TEXT,
  "full_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "organization" TEXT,
  "region_name" TEXT,
  "guest_group" TEXT,
  "registration_status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "registration_source" TEXT NOT NULL DEFAULT 'SELF',
  "registered_by" TEXT,
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_by" TEXT,
  "cancelled_at" TIMESTAMP(3),
  "cancellation_reason" TEXT,
  "seating_unit_id" TEXT,
  "seat_number" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_registrations_participant_type_check" CHECK ("participant_type" IN ('MEMBER', 'INVITED_GUEST')),
  CONSTRAINT "event_registrations_identity_check" CHECK (
    ("participant_type" = 'MEMBER' AND "person_id" IS NOT NULL) OR
    ("participant_type" = 'INVITED_GUEST' AND "person_id" IS NULL AND length(btrim("full_name")) > 0)
  ),
  CONSTRAINT "event_registrations_status_check" CHECK ("registration_status" IN ('REGISTERED', 'CANCELLED')),
  CONSTRAINT "event_registrations_source_check" CHECK ("registration_source" IN ('SELF', 'ADMIN', 'IMPORT')),
  CONSTRAINT "event_registrations_cancelled_check" CHECK (
    ("registration_status" = 'REGISTERED' AND "cancelled_at" IS NULL) OR
    ("registration_status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
  ),
  CONSTRAINT "event_registrations_seat_check" CHECK (
    ("seating_unit_id" IS NULL AND "seat_number" IS NULL) OR
    ("seating_unit_id" IS NOT NULL AND "seat_number" IS NOT NULL AND "seat_number" > 0)
  )
);

CREATE TABLE "event_attendance" (
  "id" TEXT NOT NULL,
  "registration_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "marked_at" TIMESTAMP(3),
  "marked_by" TEXT,
  "method" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_attendance_status_check" CHECK ("status" IN ('PENDING', 'PRESENT', 'ABSENT')),
  CONSTRAINT "event_attendance_method_check" CHECK ("method" IS NULL OR "method" IN ('STAFF', 'SELF')),
  CONSTRAINT "event_attendance_mark_check" CHECK (
    ("status" = 'PENDING' AND "marked_at" IS NULL) OR
    ("status" IN ('PRESENT', 'ABSENT') AND "marked_at" IS NOT NULL)
  )
);

CREATE TABLE "person_activities" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "registration_id" TEXT NOT NULL,
  "activity_type" TEXT NOT NULL DEFAULT 'EVENT_PARTICIPATION',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "person_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "person_activities_type_check" CHECK ("activity_type" = 'EVENT_PARTICIPATION'),
  CONSTRAINT "person_activities_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT "person_activities_revoked_check" CHECK (
    ("status" = 'ACTIVE' AND "revoked_at" IS NULL) OR
    ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "event_seating_units_event_label_unique" ON "event_seating_units"("event_id", "label");
CREATE INDEX "event_seating_units_event_order_idx" ON "event_seating_units"("event_id", "sort_order");
CREATE UNIQUE INDEX "event_registrations_event_person_unique" ON "event_registrations"("event_id", "person_id");
CREATE UNIQUE INDEX "event_registrations_event_seat_unique" ON "event_registrations"("event_id", "seating_unit_id", "seat_number");
CREATE INDEX "event_registrations_event_status_idx" ON "event_registrations"("event_id", "registration_status", "registered_at");
CREATE INDEX "event_registrations_person_idx" ON "event_registrations"("person_id", "registered_at");
CREATE UNIQUE INDEX "event_attendance_registration_id_key" ON "event_attendance"("registration_id");
CREATE INDEX "event_attendance_status_idx" ON "event_attendance"("status", "marked_at");
CREATE UNIQUE INDEX "person_activities_registration_id_key" ON "person_activities"("registration_id");
CREATE UNIQUE INDEX "person_activities_event_person_type_unique" ON "person_activities"("event_id", "person_id", "activity_type");
CREATE INDEX "person_activities_person_status_idx" ON "person_activities"("person_id", "status", "occurred_at");
CREATE INDEX "person_activities_event_status_idx" ON "person_activities"("event_id", "status");

ALTER TABLE "event_seating_units" ADD CONSTRAINT "event_seating_units_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_registered_by_fkey"
  FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_cancelled_by_fkey"
  FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_seating_unit_id_fkey"
  FOREIGN KEY ("seating_unit_id") REFERENCES "event_seating_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_marked_by_fkey"
  FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "person_activities" ADD CONSTRAINT "person_activities_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_event_participation_history_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Event registration, attendance, and activity history cannot be physically deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_event_registration_delete_trigger
BEFORE DELETE ON "event_registrations"
FOR EACH ROW EXECUTE FUNCTION prevent_event_participation_history_delete();
CREATE TRIGGER prevent_event_attendance_delete_trigger
BEFORE DELETE ON "event_attendance"
FOR EACH ROW EXECUTE FUNCTION prevent_event_participation_history_delete();
CREATE TRIGGER prevent_person_activity_delete_trigger
BEFORE DELETE ON "person_activities"
FOR EACH ROW EXECUTE FUNCTION prevent_event_participation_history_delete();

INSERT INTO "permissions" ("id", "slug", "description", "created_at") VALUES
  ('permission-events-participants-read', 'events.participants.read', 'Іс-шара қатысушыларының тізімін scope шегінде көру', CURRENT_TIMESTAMP),
  ('permission-events-participants-manage', 'events.participants.manage', 'Іс-шара қатысушыларын scope шегінде басқару', CURRENT_TIMESTAMP),
  ('permission-events-attendance-manage', 'events.attendance.manage', 'Іс-шараға қатысуды scope шегінде белгілеу', CURRENT_TIMESTAMP),
  ('permission-events-seating-manage', 'events.seating.manage', 'Іс-шарадағы орындарды scope шегінде басқару', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp-' || r."slug" || '-' || p."slug", r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."slug" IN ('president', 'vice_president_2', 'branch_director', 'branch_event_manager')
  AND p."slug" IN (
    'events.participants.read', 'events.participants.manage',
    'events.attendance.manage', 'events.seating.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "action_type", "target_entity", "target_entity_id", "new_value", "reason", "created_at"
) VALUES (
  'audit-phase-2-3-event-participation-20260901',
  'platform.phase_2_3_event_participation_installed',
  'platform_schema',
  'phase-2-3-event-participation',
  '{"memberRegistration":true,"invitedGuests":true,"attendanceSeparate":true,"profileActivity":true,"seating":true,"publicNameSearch":false}',
  'Phase 2.3 тіркелу, қатысу, reception, орын және профиль қызметі енгізілді',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
