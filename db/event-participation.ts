import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { canManageGlobalEvents, eventBranchScopeIds } from "@/lib/authorization";
import type { AppUser } from "@/lib/types";

export async function getPublicEventRegistrationState(eventId: string, personId?: string | null) {
  await ensureDatabase();
  const database = getDb();
  const [activeCount, ownRegistration] = await Promise.all([
    database.eventRegistration.count({ where: { eventId, registrationStatus: "REGISTERED" } }),
    personId ? database.eventRegistration.findUnique({
      where: { eventId_personId: { eventId, personId } },
      include: { attendance: true, seatingUnit: true },
    }) : null,
  ]);
  return { activeCount, ownRegistration };
}

export async function getEventParticipationBundle(eventId: string) {
  await ensureDatabase();
  const database = getDb();
  const [event, registrations, seatingUnits] = await Promise.all([
    database.event.findUnique({ where: { id: eventId }, include: { branch: true } }),
    database.eventRegistration.findMany({
      where: { eventId },
      include: {
        attendance: true,
        seatingUnit: true,
        person: { select: { id: true, fullName: true, branchId: true, branch: { select: { regionName: true } } } },
      },
      orderBy: [{ registrationStatus: "desc" }, { fullName: "asc" }],
    }),
    database.eventSeatingUnit.findMany({ where: { eventId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  return { event, registrations, seatingUnits };
}

export async function getEventParticipationSummary(eventId: string) {
  await ensureDatabase();
  const database = getDb();
  const [registered, present, cancelled] = await Promise.all([
    database.eventRegistration.count({ where: { eventId, registrationStatus: "REGISTERED" } }),
    database.eventAttendance.count({ where: { registration: { eventId, registrationStatus: "REGISTERED" }, status: "PRESENT" } }),
    database.eventRegistration.count({ where: { eventId, registrationStatus: "CANCELLED" } }),
  ]);
  return { registered, present, cancelled };
}

export async function listEligibleEventMembers(actor: AppUser, event: { branchId: string | null }) {
  await ensureDatabase();
  const global = canManageGlobalEvents(actor);
  const scopes = eventBranchScopeIds(actor);
  return getDb().personProfile.findMany({
    where: {
      archivedAt: null,
      membershipStatus: "member",
      ...(event.branchId ? { branchId: event.branchId } : global ? {} : { branchId: { in: scopes } }),
    },
    select: { id: true, fullName: true, email: true, phone: true, branch: { select: { regionName: true } } },
    orderBy: { fullName: "asc" },
    take: 2_000,
  });
}

export async function getPublicLiveEvent(slug: string) {
  await ensureDatabase();
  const database = getDb();
  const event = await database.event.findFirst({
    where: { slug, publishedAt: { not: null }, archivedAt: null, status: { in: ["PUBLISHED", "POSTPONED", "CANCELLED", "COMPLETED"] } },
    select: { id: true, slug: true, title: true, summary: true, startAt: true, endAt: true, participantLimit: true, seatingType: true, status: true },
  });
  if (!event) return null;
  const [registered, present, absent] = await Promise.all([
    database.eventRegistration.count({ where: { eventId: event.id, registrationStatus: "REGISTERED" } }),
    database.eventAttendance.count({ where: { registration: { eventId: event.id, registrationStatus: "REGISTERED" }, status: "PRESENT" } }),
    database.eventAttendance.count({ where: { registration: { eventId: event.id, registrationStatus: "REGISTERED" }, status: "ABSENT" } }),
  ]);
  return { ...event, registered, present, absent, remaining: event.participantLimit == null ? null : Math.max(0, event.participantLimit - registered) };
}
