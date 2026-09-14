import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedEvent, canManageEventResults } from "@/lib/authorization";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { parseEventResultForm } from "@/lib/events";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    if (!canManageEventResults(actor)) return new Response("Forbidden", { status: 403 });
    const database = getDb();
    const event = await database.event.findUnique({ where: { id }, include: { result: true } });
    if (!event) return new Response("Not found", { status: 404 });
    if (!canAccessManagedEvent(actor, event) || event.status === "ARCHIVED") return new Response("Forbidden", { status: 403 });
    const input = parseEventResultForm(await request.formData());
    const now = new Date();
    await database.$transaction(async (transaction) => {
      const result = await transaction.eventResult.upsert({
        where: { eventId: id },
        create: { eventId: id, ...input, updatedBy: actor.id, createdAt: now, updatedAt: now },
        update: { ...input, updatedBy: actor.id, updatedAt: now },
      });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: event.result ? "event.result_updated" : "event.result_created",
        targetEntity: "event_result", targetEntityId: id, previousValue: serializeAuditValue(event.result), newValue: serializeAuditValue(result),
        reason: "Іс-шараның құрылымдалған қорытындысы сақталды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    return Response.redirect(new URL(`/dashboard/events/${id}?success=result`, request.url), 303);
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("INVALID_EVENT_RESULT") ? "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/events/${id}?error=${reason}`, request.url), 303);
  }
}
