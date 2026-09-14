import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  canAccessManagedEvent, canManageEventAttendance, canManageEventParticipants, canManageEventSeating,
} from "@/lib/authorization";
import { attendanceStatuses, cleanText } from "@/lib/event-participation";
import { assertSameOrigin, clientIp } from "@/lib/security";

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function result(request: Request, eventId: string, ok: boolean, code: string, status = ok ? 200 : 400) {
  if (wantsJson(request)) return Response.json({ ok, code }, { status });
  return Response.redirect(new URL(`/dashboard/events/${eventId}/participants?${ok ? "success" : "error"}=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const event = await database.event.findUnique({ where: { id } });
    if (!event) return new Response("Not found", { status: 404 });
    if (!canAccessManagedEvent(actor, event)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    const now = new Date();

    if (action === "add_guest" || action === "add_member" || action === "cancel" || action === "restore") {
      if (!canManageEventParticipants(actor)) return new Response("Forbidden", { status: 403 });
    }
    if (action === "attendance" && !canManageEventAttendance(actor)) return new Response("Forbidden", { status: 403 });
    if (action === "assign_seat" && !canManageEventSeating(actor)) return new Response("Forbidden", { status: 403 });

    if (action === "add_guest") {
      const fullName = cleanText(form, "fullName", 250, true)!;
      const email = cleanText(form, "email", 320);
      const phone = cleanText(form, "phone", 80);
      const organization = cleanText(form, "organization", 500);
      const regionName = cleanText(form, "regionName", 180);
      const guestGroup = cleanText(form, "guestGroup", 180);
      const registrationId = crypto.randomUUID();
      await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "events" WHERE "id" = ${id} FOR UPDATE`;
        const current = await transaction.event.findUnique({ where: { id } });
        const activeCount = await transaction.eventRegistration.count({ where: { eventId: id, registrationStatus: "REGISTERED" } });
        if (current?.participantLimit != null && activeCount >= current.participantLimit) throw new Error("EVENT_FULL");
        await transaction.eventRegistration.create({ data: {
          id: registrationId, eventId: id, participantType: "INVITED_GUEST", fullName, email, phone, organization,
          regionName, guestGroup, registrationStatus: "REGISTERED", registrationSource: "ADMIN", registeredBy: actor.id, registeredAt: now,
          attendance: { create: { id: crypto.randomUUID(), status: "PENDING" } },
        } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.participant.guest_added",
          targetEntity: "event_registration", targetEntityId: registrationId,
          newValue: JSON.stringify({ eventId: id, participantType: "INVITED_GUEST", fullName }),
          reason: "Шақырылған қонақ қатысушылар тізіміне қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return result(request, id, true, "guest-added");
    }

    if (action === "add_member") {
      const personId = cleanText(form, "personId", 120, true)!;
      const profile = await database.personProfile.findFirst({
        where: { id: personId, archivedAt: null, membershipStatus: "member", ...(event.branchId ? { branchId: event.branchId } : {}) },
        include: { branch: { select: { regionName: true } } },
      });
      if (!profile) return result(request, id, false, "invalid-member");
      await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "events" WHERE "id" = ${id} FOR UPDATE`;
        const existing = await transaction.eventRegistration.findUnique({ where: { eventId_personId: { eventId: id, personId } } });
        if (existing?.registrationStatus === "REGISTERED") return;
        const current = await transaction.event.findUnique({ where: { id } });
        const activeCount = await transaction.eventRegistration.count({ where: { eventId: id, registrationStatus: "REGISTERED" } });
        if (current?.participantLimit != null && activeCount >= current.participantLimit) throw new Error("EVENT_FULL");
        const registration = existing ? await transaction.eventRegistration.update({ where: { id: existing.id }, data: {
          registrationStatus: "REGISTERED", registeredBy: actor.id, registeredAt: now, registrationSource: "ADMIN",
          cancelledBy: null, cancelledAt: null, cancellationReason: null, seatingUnitId: null, seatNumber: null,
          fullName: profile.fullName, email: profile.email, phone: profile.phone,
          organization: profile.workplace, regionName: profile.branch?.regionName ?? profile.cityDistrict,
        } }) : await transaction.eventRegistration.create({ data: {
          id: crypto.randomUUID(), eventId: id, participantType: "MEMBER", personId, fullName: profile.fullName,
          email: profile.email, phone: profile.phone, organization: profile.workplace,
          regionName: profile.branch?.regionName ?? profile.cityDistrict,
          registrationStatus: "REGISTERED", registrationSource: "ADMIN", registeredBy: actor.id, registeredAt: now,
        } });
        await transaction.eventAttendance.upsert({ where: { registrationId: registration.id },
          create: { id: crypto.randomUUID(), registrationId: registration.id, status: "PENDING" },
          update: { status: "PENDING", markedAt: null, markedBy: null, method: null },
        });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: existing ? "event.participant.restored" : "event.participant.member_added",
          targetEntity: "event_registration", targetEntityId: registration.id,
          newValue: JSON.stringify({ eventId: id, personId, status: "REGISTERED", source: "ADMIN" }),
          reason: "Мүше іс-шара қатысушыларына уәкілетті қызметкер арқылы қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return result(request, id, true, "member-added");
    }

    if (action === "cancel" || action === "restore") {
      const registrationId = cleanText(form, "registrationId", 120, true)!;
      const registration = await database.eventRegistration.findFirst({ where: { id: registrationId, eventId: id } });
      if (!registration) return result(request, id, false, "not-found", 404);
      if (action === "cancel") {
        const reason = cleanText(form, "reason", 1_000, true)!;
        await database.$transaction(async (transaction) => {
          await transaction.eventRegistration.update({ where: { id: registrationId }, data: {
            registrationStatus: "CANCELLED", cancelledBy: actor.id, cancelledAt: now, cancellationReason: reason,
            seatingUnitId: null, seatNumber: null,
          } });
          await transaction.eventAttendance.updateMany({ where: { registrationId }, data: { status: "PENDING", markedAt: null, markedBy: null, method: null } });
          await transaction.personActivity.updateMany({ where: { registrationId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
          await transaction.auditLog.create({ data: {
            id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.participant.cancelled",
            targetEntity: "event_registration", targetEntityId: registrationId,
            previousValue: JSON.stringify({ status: registration.registrationStatus }), newValue: JSON.stringify({ status: "CANCELLED" }),
            reason, ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
          } });
        });
        return result(request, id, true, "cancelled");
      }
      await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "events" WHERE "id" = ${id} FOR UPDATE`;
        const current = await transaction.event.findUnique({ where: { id } });
        const activeCount = await transaction.eventRegistration.count({ where: { eventId: id, registrationStatus: "REGISTERED" } });
        if (current?.participantLimit != null && activeCount >= current.participantLimit) throw new Error("EVENT_FULL");
        await transaction.eventRegistration.update({ where: { id: registrationId }, data: {
          registrationStatus: "REGISTERED", cancelledBy: null, cancelledAt: null, cancellationReason: null, registeredBy: actor.id, registeredAt: now,
        } });
        await transaction.eventAttendance.upsert({ where: { registrationId }, create: { id: crypto.randomUUID(), registrationId, status: "PENDING" }, update: { status: "PENDING", markedAt: null, markedBy: null, method: null } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.participant.restored",
          targetEntity: "event_registration", targetEntityId: registrationId,
          newValue: JSON.stringify({ status: "REGISTERED" }), reason: "Қатысушы тізімге қайтарылды",
          ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return result(request, id, true, "restored");
    }

    if (action === "attendance") {
      const registrationId = cleanText(form, "registrationId", 120, true)!;
      const status = String(form.get("status") ?? "");
      if (!(attendanceStatuses as readonly string[]).includes(status)) return result(request, id, false, "invalid-attendance");
      const registration = await database.eventRegistration.findFirst({ where: { id: registrationId, eventId: id }, include: { attendance: true } });
      if (!registration || registration.registrationStatus !== "REGISTERED") return result(request, id, false, "not-active", 409);
      await database.$transaction(async (transaction) => {
        await transaction.eventAttendance.upsert({ where: { registrationId },
          create: { id: crypto.randomUUID(), registrationId, status, markedAt: status === "PENDING" ? null : now, markedBy: status === "PENDING" ? null : actor.id, method: status === "PENDING" ? null : "STAFF" },
          update: { status, markedAt: status === "PENDING" ? null : now, markedBy: status === "PENDING" ? null : actor.id, method: status === "PENDING" ? null : "STAFF" },
        });
        if (registration.personId) {
          if (status === "PRESENT") {
            await transaction.personActivity.upsert({ where: { registrationId },
              create: { id: crypto.randomUUID(), personId: registration.personId, eventId: id, registrationId, title: event.title, description: event.summary, occurredAt: event.startAt, status: "ACTIVE" },
              update: { title: event.title, description: event.summary, occurredAt: event.startAt, status: "ACTIVE", revokedAt: null },
            });
          } else {
            await transaction.personActivity.updateMany({ where: { registrationId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
          }
        }
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: `event.attendance.${status.toLowerCase()}`,
          targetEntity: "event_attendance", targetEntityId: registration.attendance?.id ?? registrationId,
          previousValue: JSON.stringify({ status: registration.attendance?.status ?? "PENDING" }), newValue: JSON.stringify({ status }),
          reason: "Қатысу мәртебесі уәкілетті қызметкермен белгіленді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return result(request, id, true, status.toLowerCase());
    }

    if (action === "assign_seat") {
      const registrationId = cleanText(form, "registrationId", 120, true)!;
      const seatKey = cleanText(form, "seatKey", 180);
      const legacySeatingUnitId = cleanText(form, "seatingUnitId", 120);
      const legacySeatRaw = cleanText(form, "seatNumber", 10);
      const separator = seatKey?.lastIndexOf(":") ?? -1;
      const seatingUnitId = seatKey && separator > 0 ? seatKey.slice(0, separator) : legacySeatingUnitId;
      const seatRaw = seatKey && separator > 0 ? seatKey.slice(separator + 1) : legacySeatRaw;
      const registration = await database.eventRegistration.findFirst({ where: { id: registrationId, eventId: id } });
      if (!registration || registration.registrationStatus !== "REGISTERED") return result(request, id, false, "not-active", 409);
      let seatNumber: number | null = null;
      if (seatingUnitId) {
        seatNumber = Number(seatRaw);
        const unit = await database.eventSeatingUnit.findFirst({ where: { id: seatingUnitId, eventId: id } });
        if (!unit || !Number.isSafeInteger(seatNumber) || seatNumber < 1 || seatNumber > unit.seatCount) return result(request, id, false, "invalid-seat");
      }
      await database.$transaction(async (transaction) => {
        await transaction.eventRegistration.update({ where: { id: registrationId }, data: { seatingUnitId, seatNumber } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.seat.assigned", targetEntity: "event_registration", targetEntityId: registrationId,
          previousValue: JSON.stringify({ seatingUnitId: registration.seatingUnitId, seatNumber: registration.seatNumber }),
          newValue: JSON.stringify({ seatingUnitId, seatNumber }), reason: seatingUnitId ? "Қатысушыға орын белгіленді" : "Қатысушының орны босатылды",
          ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return result(request, id, true, "seat-saved");
    }

    return result(request, id, false, "invalid-action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "EVENT_FULL") return result(request, id, false, "full", 409);
    if (message.includes("Unique constraint")) return result(request, id, false, "seat-taken", 409);
    if (message.startsWith("INVALID_PARTICIPANT")) return result(request, id, false, "validation");
    return result(request, id, false, "unexpected", 500);
  }
}
