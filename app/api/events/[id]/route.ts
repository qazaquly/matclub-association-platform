import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedEvent, canManageGlobalEvents, canManagePublicMedia, canPublishEvents } from "@/lib/authorization";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { isPublicEventStatus, parseEventForm } from "@/lib/events";
import { activatePublicMedia, archivePublicMedia, createPublicMedia, discardPublicMedia } from "@/lib/public-media";
import { assertSameOrigin, clientIp } from "@/lib/security";

function uploadedFile(form: FormData) {
  const value = form.get("image");
  return value && typeof value === "object" && "arrayBuffer" in value && (value as File).size > 0 ? value as File : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let freshMediaId: string | null = null;
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const previous = await database.event.findUnique({ where: { id }, include: { result: true } });
    if (!previous) return new Response("Not found", { status: 404 });
    if (!canAccessManagedEvent(actor, previous)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") ?? "save");
    const allowedActions = ["save", "submit", "publish", "postpone", "cancel", "complete", "archive", "restore"];
    if (!allowedActions.includes(action)) throw new Error("INVALID_EVENT:action");

    const global = canManageGlobalEvents(actor);
    if (!global && (action !== "save" && action !== "submit")) return new Response("Forbidden", { status: 403 });
    if (!global && previous.status !== "DRAFT") return new Response("Forbidden", { status: 403 });
    if (["publish", "postpone", "cancel", "complete", "archive", "restore"].includes(action) && !canPublishEvents(actor)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (action === "save" && isPublicEventStatus(previous.status) && !canPublishEvents(actor)) return new Response("Forbidden", { status: 403 });

    const file = action === "save" ? uploadedFile(form) : null;
    if (file && !canManagePublicMedia(actor)) return new Response("Forbidden", { status: 403 });
    const media = await createPublicMedia(file, actor.id);
    freshMediaId = media?.id ?? null;
    const now = new Date();

    await database.$transaction(async (transaction) => {
      let updated;
      let actionType = "event.updated";
      let reason = "Іс-шара деректері жаңартылды";
      if (action === "save") {
        const input = parseEventForm(form);
        if (!global && (input.eventScope !== "BRANCH" || input.branchId !== previous.branchId || input.responsibleDepartmentId)) {
          throw new Error("EVENT_SCOPE_FORBIDDEN");
        }
        if (input.branchId && !(await transaction.branch.findFirst({ where: { id: input.branchId, status: "active", archivedAt: null }, select: { id: true } }))) {
          throw new Error("INVALID_EVENT:branchId");
        }
        if (input.responsibleProfileId) {
          const profile = await transaction.personProfile.findFirst({ where: { id: input.responsibleProfileId, archivedAt: null }, select: { branchId: true } });
          if (!profile || (!global && profile.branchId !== previous.branchId)) throw new Error("INVALID_EVENT:responsibleProfileId");
        }
        if (input.responsibleDepartmentId && !(await transaction.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) {
          throw new Error("INVALID_EVENT:responsibleDepartmentId");
        }
        const removeImage = form.get("removeImage") === "on";
        const coverMediaId = freshMediaId || (removeImage ? null : previous.coverMediaId);
        updated = await transaction.event.update({ where: { id }, data: { ...input, coverMediaId, updatedBy: actor.id, updatedAt: now } });
        if ((freshMediaId || removeImage) && previous.coverMediaId && previous.coverMediaId !== coverMediaId) await archivePublicMedia(transaction, previous.coverMediaId);
      } else {
        const statusNote = String(form.get("statusNote") ?? "").trim();
        if (["postpone", "cancel", "archive"].includes(action) && (statusNote.length < 3 || statusNote.length > 1_000)) throw new Error("INVALID_EVENT:statusNote");
        if (action === "submit" && previous.status !== "DRAFT") throw new Error("INVALID_EVENT:transition");
        if (action === "publish" && !["DRAFT", "SUBMITTED", "POSTPONED"].includes(previous.status)) throw new Error("INVALID_EVENT:transition");
        if (action === "postpone" && !previous.publishedAt) throw new Error("INVALID_EVENT:transition");
        if (action === "cancel" && !previous.publishedAt) throw new Error("INVALID_EVENT:transition");
        if (action === "complete" && (!previous.publishedAt || !previous.result)) throw new Error("INVALID_EVENT:result_required");
        if (action === "archive" && !previous.publishedAt && previous.status !== "DRAFT" && previous.status !== "SUBMITTED") throw new Error("INVALID_EVENT:transition");

        const status = action === "submit" ? "SUBMITTED"
          : action === "publish" ? "PUBLISHED"
            : action === "postpone" ? "POSTPONED"
              : action === "cancel" ? "CANCELLED"
                : action === "complete" ? "COMPLETED"
                  : action === "archive" ? "ARCHIVED"
                    : previous.publishedAt ? "PUBLISHED" : "DRAFT";
        const data = {
          status,
          statusNote: statusNote || (action === "restore" ? null : previous.statusNote),
          submittedAt: action === "submit" ? now : previous.submittedAt,
          publishedAt: action === "publish" ? (previous.publishedAt ?? now) : previous.publishedAt,
          postponedAt: action === "postpone" ? now : previous.postponedAt,
          cancelledAt: action === "cancel" ? now : previous.cancelledAt,
          completedAt: action === "complete" ? now : previous.completedAt,
          archivedAt: action === "archive" ? now : action === "restore" ? null : previous.archivedAt,
          updatedBy: actor.id,
          updatedAt: now,
        };
        updated = await transaction.event.update({ where: { id }, data });
        if (status === "ARCHIVED") await archivePublicMedia(transaction, previous.coverMediaId);
        else if (isPublicEventStatus(status)) await activatePublicMedia(transaction, previous.coverMediaId);
        actionType = `event.${action === "cancel" ? "cancelled" : action === "complete" ? "completed" : action === "postpone" ? "postponed" : action === "publish" ? "published" : action === "submit" ? "submitted" : action === "archive" ? "archived" : "restored"}`;
        reason = statusNote || `Іс-шара мәртебесі ${status} күйіне өзгертілді`;
      }

      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType, targetEntity: "event", targetEntityId: id,
        previousValue: serializeAuditValue(previous), newValue: serializeAuditValue(updated), reason,
        ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    return Response.redirect(new URL(`/dashboard/events/${id}?success=${encodeURIComponent(action)}`, request.url), 303);
  } catch (error) {
    if (freshMediaId) await discardPublicMedia(freshMediaId).catch(() => undefined);
    if (error instanceof Error && error.message === "EVENT_SCOPE_FORBIDDEN") return new Response("Forbidden", { status: 403 });
    const reason = error instanceof Error && (error.message.startsWith("INVALID_EVENT") || error.message.includes("Unique constraint")) ? error.message.includes("result_required") ? "result-required" : "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/events/${id}?error=${reason}`, request.url), 303);
  }
}
