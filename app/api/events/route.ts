import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageBranchEvents, canManageGlobalEvents, canManagePublicMedia, eventBranchScopeIds } from "@/lib/authorization";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { parseEventForm } from "@/lib/events";
import { createPublicMedia, discardPublicMedia } from "@/lib/public-media";
import { assertSameOrigin, clientIp } from "@/lib/security";

function uploadedFile(form: FormData) {
  const value = form.get("image");
  return value && typeof value === "object" && "arrayBuffer" in value && (value as File).size > 0 ? value as File : null;
}

export async function POST(request: Request) {
  let freshMediaId: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    if (!canManageGlobalEvents(actor) && !canManageBranchEvents(actor)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const input = parseEventForm(form);
    if (input.eventScope === "NATIONAL" && !canManageGlobalEvents(actor)) return new Response("Forbidden", { status: 403 });
    if (input.eventScope === "BRANCH" && !canManageGlobalEvents(actor) && !eventBranchScopeIds(actor).includes(input.branchId!)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!canManageGlobalEvents(actor) && input.responsibleDepartmentId) return new Response("Forbidden", { status: 403 });

    const file = uploadedFile(form);
    if (file && !canManagePublicMedia(actor)) return new Response("Forbidden", { status: 403 });
    const media = await createPublicMedia(file, actor.id);
    freshMediaId = media?.id ?? null;
    const database = getDb();
    const id = crypto.randomUUID();
    const now = new Date();

    await database.$transaction(async (transaction) => {
      if (input.branchId && !(await transaction.branch.findFirst({ where: { id: input.branchId, status: "active", archivedAt: null }, select: { id: true } }))) {
        throw new Error("INVALID_EVENT:branchId");
      }
      if (input.responsibleProfileId) {
        const profile = await transaction.personProfile.findFirst({ where: { id: input.responsibleProfileId, archivedAt: null }, select: { branchId: true } });
        if (!profile || (!canManageGlobalEvents(actor) && profile.branchId !== input.branchId)) throw new Error("INVALID_EVENT:responsibleProfileId");
      }
      if (input.responsibleDepartmentId && !(await transaction.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) {
        throw new Error("INVALID_EVENT:responsibleDepartmentId");
      }
      const created = await transaction.event.create({ data: {
        id, ...input, coverMediaId: freshMediaId, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now,
      } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "event.created", targetEntity: "event", targetEntityId: id,
        newValue: serializeAuditValue(created), reason: "Іс-шара жобасы құрылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    return Response.redirect(new URL(`/dashboard/events/${id}?success=created`, request.url), 303);
  } catch (error) {
    if (freshMediaId) await discardPublicMedia(freshMediaId).catch(() => undefined);
    const reason = error instanceof Error && (error.message.startsWith("INVALID_EVENT") || error.message.includes("Unique constraint")) ? "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/events?error=${reason}`, request.url), 303);
  }
}
