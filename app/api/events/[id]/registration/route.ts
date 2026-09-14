import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { registrationIsOpen } from "@/lib/event-participation";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, slug: string, key: "success" | "error", value: string) {
  return Response.redirect(new URL(`/events/${slug}?${key}=${encodeURIComponent(value)}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let slug = "";
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const event = await database.event.findUnique({ where: { id } });
    if (!event || !event.publishedAt || event.archivedAt) return new Response("Not found", { status: 404 });
    slug = event.slug;
    const form = await request.formData();
    const action = String(form.get("action") ?? "register");
    const now = new Date();

    if (action === "register") {
      if (actor.membershipStatus !== "member") return redirect(request, slug, "error", "members-only");
      if (!registrationIsOpen(event, now)) return redirect(request, slug, "error", "registration-closed");
      const profile = await database.personProfile.findUnique({ where: { id: actor.profileId }, include: { branch: { select: { regionName: true } } } });
      if (!profile || profile.archivedAt) return new Response("Forbidden", { status: 403 });

      await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "events" WHERE "id" = ${id} FOR UPDATE`;
        const current = await transaction.event.findUnique({ where: { id } });
        if (!current || !registrationIsOpen(current, new Date())) throw new Error("REGISTRATION_CLOSED");
        const existing = await transaction.eventRegistration.findUnique({ where: { eventId_personId: { eventId: id, personId: actor.profileId } } });
        if (existing?.registrationStatus === "REGISTERED") return;
        const activeCount = await transaction.eventRegistration.count({ where: { eventId: id, registrationStatus: "REGISTERED" } });
        if (current.participantLimit != null && activeCount >= current.participantLimit) throw new Error("EVENT_FULL");
        const registration = existing
          ? await transaction.eventRegistration.update({ where: { id: existing.id }, data: {
            registrationStatus: "REGISTERED", registrationSource: "SELF", registeredBy: actor.id, registeredAt: now,
            cancelledBy: null, cancelledAt: null, cancellationReason: null, seatingUnitId: null, seatNumber: null,
            fullName: profile.fullName, email: profile.email, phone: profile.phone, regionName: profile.branch?.regionName ?? profile.cityDistrict,
          } })
          : await transaction.eventRegistration.create({ data: {
            id: crypto.randomUUID(), eventId: id, participantType: "MEMBER", personId: actor.profileId,
            fullName: profile.fullName, email: profile.email, phone: profile.phone,
            organization: profile.workplace, regionName: profile.branch?.regionName ?? profile.cityDistrict,
            registrationStatus: "REGISTERED", registrationSource: "SELF", registeredBy: actor.id, registeredAt: now,
          } });
        await transaction.eventAttendance.upsert({
          where: { registrationId: registration.id },
          create: { id: crypto.randomUUID(), registrationId: registration.id, status: "PENDING" },
          update: { status: "PENDING", markedAt: null, markedBy: null, method: null },
        });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: existing ? "event.registration.restored" : "event.registration.created",
          targetEntity: "event_registration", targetEntityId: registration.id,
          newValue: JSON.stringify({ eventId: id, personId: actor.profileId, status: "REGISTERED", source: "SELF" }),
          reason: "Мүше іс-шараға өз аккаунтымен тіркелді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return redirect(request, slug, "success", "registered");
    }

    if (action === "cancel") {
      if (event.startAt <= now) return redirect(request, slug, "error", "event-started");
      const registration = await database.eventRegistration.findUnique({ where: { eventId_personId: { eventId: id, personId: actor.profileId } } });
      if (!registration || registration.registrationStatus !== "REGISTERED") return redirect(request, slug, "error", "not-registered");
      await database.$transaction(async (transaction) => {
        await transaction.eventRegistration.update({ where: { id: registration.id }, data: {
          registrationStatus: "CANCELLED", cancelledBy: actor.id, cancelledAt: now,
          cancellationReason: "Қатысушы іс-шара басталғанға дейін бас тартты", seatingUnitId: null, seatNumber: null,
        } });
        await transaction.eventAttendance.updateMany({ where: { registrationId: registration.id }, data: { status: "PENDING", markedAt: null, markedBy: null, method: null } });
        await transaction.personActivity.updateMany({ where: { registrationId: registration.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.registration.cancelled",
          targetEntity: "event_registration", targetEntityId: registration.id,
          previousValue: JSON.stringify({ status: "REGISTERED" }), newValue: JSON.stringify({ status: "CANCELLED" }),
          reason: "Қатысушы іс-шара басталғанға дейін бас тартты", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return redirect(request, slug, "success", "cancelled");
    }
    return redirect(request, slug, "error", "invalid-action");
  } catch (error) {
    const code = error instanceof Error && error.message === "EVENT_FULL" ? "full"
      : error instanceof Error && error.message === "REGISTRATION_CLOSED" ? "registration-closed" : "unexpected";
    return slug ? redirect(request, slug, "error", code) : new Response("Unexpected error", { status: 500 });
  }
}
