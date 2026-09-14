import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageDynamicContent, canManagePublicMedia } from "@/lib/authorization";
import { isDynamicContentKind, parseDynamicContentForm, serializeAuditValue } from "@/lib/dynamic-content";
import { createPublicMedia, discardPublicMedia } from "@/lib/public-media";
import { assertSameOrigin, clientIp } from "@/lib/security";

function uploadedFile(form: FormData) {
  const value = form.get("image");
  return value && typeof value === "object" && "arrayBuffer" in value ? value as File : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  let freshMediaId: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    if (!canManageDynamicContent(actor)) return new Response("Forbidden", { status: 403 });
    const { kind: rawKind } = await params;
    if (!isDynamicContentKind(rawKind)) return new Response("Not found", { status: 404 });

    const form = await request.formData();
    const file = uploadedFile(form);
    if (file && !canManagePublicMedia(actor)) return new Response("Forbidden", { status: 403 });
    const media = await createPublicMedia(file, actor.id);
    freshMediaId = media?.id ?? null;
    const id = crypto.randomUUID();
    const now = new Date();
    const database = getDb();

    await database.$transaction(async (transaction) => {
      let created: unknown;
      if (rawKind === "news") created = await transaction.news.create({ data: {
        id, ...parseDynamicContentForm("news", form), coverMediaId: freshMediaId, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id,
      } });
      else if (rawKind === "publications") created = await transaction.publication.create({ data: {
        id, ...parseDynamicContentForm("publications", form), coverMediaId: freshMediaId, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id,
      } });
      else if (rawKind === "projects") created = await transaction.publicProject.create({ data: {
        id, ...parseDynamicContentForm("projects", form), coverMediaId: freshMediaId, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id,
      } });
      else created = await transaction.partner.create({ data: {
        id, ...parseDynamicContentForm("partners", form), logoMediaId: freshMediaId, status: "inactive", createdBy: actor.id, updatedBy: actor.id,
      } });

      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "dynamic_content.created",
        targetEntity: rawKind, targetEntityId: id, newValue: serializeAuditValue(created),
        reason: "Динамикалық ашық мазмұнның жобасы құрылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });

    return Response.redirect(new URL(`/dashboard/content/${rawKind}/${id}?success=created`, request.url), 303);
  } catch (error) {
    if (freshMediaId) await discardPublicMedia(freshMediaId).catch(() => undefined);
    const { kind } = await params;
    const reason = error instanceof Error && (error.message.startsWith("INVALID_CONTENT") || error.message.includes("Unique constraint")) ? "validation" : "unexpected";
    const safeKind = isDynamicContentKind(kind) ? kind : "news";
    return Response.redirect(new URL(`/dashboard/content/${safeKind}?error=${reason}`, request.url), 303);
  }
}
