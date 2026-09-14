import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageDynamicContent, canManagePublicMedia, canPublishDynamicContent } from "@/lib/authorization";
import { isDynamicContentKind, parseDynamicContentForm, serializeAuditValue } from "@/lib/dynamic-content";
import { activatePublicMedia, archivePublicMedia, createPublicMedia, discardPublicMedia } from "@/lib/public-media";
import { assertSameOrigin, clientIp } from "@/lib/security";

function uploadedFile(form: FormData) {
  const value = form.get("image");
  return value && typeof value === "object" && "arrayBuffer" in value && (value as File).size > 0 ? value as File : null;
}

async function existingRecord(kind: string, id: string) {
  const database = getDb();
  if (kind === "news") return database.news.findUnique({ where: { id } });
  if (kind === "publications") return database.publication.findUnique({ where: { id } });
  if (kind === "projects") return database.publicProject.findUnique({ where: { id } });
  if (kind === "partners") return database.partner.findUnique({ where: { id } });
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  let freshMediaId: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    if (!canManageDynamicContent(actor)) return new Response("Forbidden", { status: 403 });
    const { kind: rawKind, id } = await params;
    if (!isDynamicContentKind(rawKind)) return new Response("Not found", { status: 404 });
    const previous = await existingRecord(rawKind, id);
    if (!previous) return new Response("Not found", { status: 404 });

    const form = await request.formData();
    const action = String(form.get("action") ?? "save");
    if (!["save", "publish", "archive", "restore"].includes(action)) throw new Error("INVALID_CONTENT:action");
    if (["publish", "archive", "restore"].includes(action) && !canPublishDynamicContent(actor)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (action === "save" && (previous.status === "PUBLISHED" || previous.status === "active") && !canPublishDynamicContent(actor)) {
      return new Response("Forbidden", { status: 403 });
    }
    const file = action === "save" ? uploadedFile(form) : null;
    if (file && !canManagePublicMedia(actor)) return new Response("Forbidden", { status: 403 });
    const media = await createPublicMedia(file, actor.id);
    freshMediaId = media?.id ?? null;
    const removeImage = action === "save" && form.get("removeImage") === "on";
    const now = new Date();
    const database = getDb();

    await database.$transaction(async (transaction) => {
      let updated: unknown;
      let actionType = "dynamic_content.updated";
      let reason = "Динамикалық ашық мазмұн жаңартылды";
      if (action === "save") {
        const oldMediaId = "coverMediaId" in previous ? previous.coverMediaId : previous.logoMediaId;
        const mediaData = freshMediaId ? freshMediaId : removeImage ? null : oldMediaId;
        if (rawKind === "news") updated = await transaction.news.update({ where: { id }, data: { ...parseDynamicContentForm("news", form), coverMediaId: mediaData, updatedBy: actor.id } });
        else if (rawKind === "publications") updated = await transaction.publication.update({ where: { id }, data: { ...parseDynamicContentForm("publications", form), coverMediaId: mediaData, updatedBy: actor.id } });
        else if (rawKind === "projects") updated = await transaction.publicProject.update({ where: { id }, data: { ...parseDynamicContentForm("projects", form), coverMediaId: mediaData, updatedBy: actor.id } });
        else updated = await transaction.partner.update({ where: { id }, data: { ...parseDynamicContentForm("partners", form), logoMediaId: mediaData, updatedBy: actor.id } });
        if ((freshMediaId || removeImage) && oldMediaId && oldMediaId !== mediaData) await archivePublicMedia(transaction, oldMediaId);
      } else if (rawKind === "partners") {
        const status = action === "archive" ? "inactive" : "active";
        updated = await transaction.partner.update({ where: { id }, data: { status, updatedBy: actor.id } });
        actionType = status === "active" ? "dynamic_content.published" : "dynamic_content.archived";
        reason = status === "active" ? "Серіктес ашық сайтта көрсетілді" : "Серіктес ашық сайттан жасырылды";
      } else {
        const oldMediaId = "coverMediaId" in previous ? previous.coverMediaId : null;
        const wasPublished = "publishedAt" in previous && Boolean(previous.publishedAt);
        const status = action === "archive" ? "ARCHIVED" : action === "publish" ? "PUBLISHED" : wasPublished ? "PUBLISHED" : "DRAFT";
        const data = {
          status,
          publishedAt: status === "PUBLISHED" ? (("publishedAt" in previous && previous.publishedAt) || now) : ("publishedAt" in previous ? previous.publishedAt : null),
          archivedAt: status === "ARCHIVED" ? now : null,
          updatedBy: actor.id,
        };
        if (rawKind === "news") updated = await transaction.news.update({ where: { id }, data });
        else if (rawKind === "publications") updated = await transaction.publication.update({ where: { id }, data });
        else updated = await transaction.publicProject.update({ where: { id }, data });
        if (status === "ARCHIVED") await archivePublicMedia(transaction, oldMediaId);
        else if (status === "PUBLISHED") await activatePublicMedia(transaction, oldMediaId);
        actionType = status === "ARCHIVED" ? "dynamic_content.archived" : status === "PUBLISHED" ? "dynamic_content.published" : "dynamic_content.restored";
        reason = status === "ARCHIVED" ? "Материал ашық сайттан архивке алынды" : status === "PUBLISHED" ? "Материал ашық сайтта жарияланды" : "Жарияланбаған жоба архивтен қайтарылды";
      }

      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType,
        targetEntity: rawKind, targetEntityId: id, previousValue: serializeAuditValue(previous), newValue: serializeAuditValue(updated),
        reason, ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });

    return Response.redirect(new URL(`/dashboard/content/${rawKind}/${id}?success=${encodeURIComponent(action)}`, request.url), 303);
  } catch (error) {
    if (freshMediaId) await discardPublicMedia(freshMediaId).catch(() => undefined);
    const { kind, id } = await params;
    const safeKind = isDynamicContentKind(kind) ? kind : "news";
    const reason = error instanceof Error && (error.message.startsWith("INVALID_CONTENT") || error.message.includes("Unique constraint")) ? "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/content/${safeKind}/${encodeURIComponent(id)}?error=${reason}`, request.url), 303);
  }
}
