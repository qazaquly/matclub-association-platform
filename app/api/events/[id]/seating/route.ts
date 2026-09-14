import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedEvent, canManageEventSeating } from "@/lib/authorization";
import { eventSeatingTypes } from "@/lib/events";
import { parseSeatLayout } from "@/lib/event-participation";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, id: string, ok: boolean, code: string) {
  return Response.redirect(new URL(`/dashboard/events/${id}/participants?${ok ? "success" : "error"}=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const event = await database.event.findUnique({ where: { id }, include: { seatingUnits: true } });
    if (!event) return new Response("Not found", { status: 404 });
    if (!canAccessManagedEvent(actor, event) || !canManageEventSeating(actor)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const seatingType = String(form.get("seatingType") ?? "NONE");
    if (!(eventSeatingTypes as readonly string[]).includes(seatingType)) throw new Error("INVALID_SEATING:type");
    const units = seatingType === "ROWS" || seatingType === "TABLES" ? parseSeatLayout(String(form.get("layout") ?? "")) : [];
    if ((seatingType === "ROWS" || seatingType === "TABLES") && units.length === 0) throw new Error("INVALID_SEATING:empty");
    const assignedCount = await database.eventRegistration.count({ where: { eventId: id, seatingUnitId: { not: null } } });
    if (assignedCount > 0 && form.get("resetAssignments") !== "on") return redirect(request, id, false, "seats-in-use");
    const now = new Date();
    await database.$transaction(async (transaction) => {
      if (assignedCount > 0) {
        await transaction.eventRegistration.updateMany({ where: { eventId: id }, data: { seatingUnitId: null, seatNumber: null } });
      }
      await transaction.eventSeatingUnit.deleteMany({ where: { eventId: id } });
      if (units.length) await transaction.eventSeatingUnit.createMany({ data: units.map((unit) => ({ ...unit, eventId: id, createdAt: now, updatedAt: now })) });
      await transaction.event.update({ where: { id }, data: { seatingType, updatedBy: actor.id, updatedAt: now } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.seating.configured", targetEntity: "event", targetEntityId: id,
        previousValue: JSON.stringify({ seatingType: event.seatingType, units: event.seatingUnits.map((unit) => ({ label: unit.label, seatCount: unit.seatCount })) }),
        newValue: JSON.stringify({ seatingType, units: units.map((unit) => ({ label: unit.label, seatCount: unit.seatCount })), resetAssignments: assignedCount > 0 }),
        reason: "Іс-шараның орын бөлу тәртібі жаңартылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    return redirect(request, id, true, "seating-saved");
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("INVALID_SEATING") ? "invalid-seating" : "unexpected";
    return redirect(request, id, false, code);
  }
}
