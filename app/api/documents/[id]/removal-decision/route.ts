import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

const schema = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().trim().min(5).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !isFullAccess(actor)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL("/dashboard/document-requests?error=validation", request.url), 303);
  await ensureDatabase();
  const database = getDb();
  const document = await database.uploadedDocument.findFirst({
    where: { id, status: "removal_requested", archivedAt: null },
    select: { id: true, objectKey: true, originalName: true, ownerPersonId: true, applicationId: true },
  });
  if (!document) return new Response("Not found", { status: 404 });
  const now = new Date();
  if (parsed.data.decision === "approve") await getPrivateObjectStorage().delete(document.objectKey);
  await database.$transaction([
    database.uploadedDocument.update({
      where: { id: document.id },
      data: parsed.data.decision === "approve"
        ? { status: "archived", archivedAt: now, updatedAt: now }
        : { status: "active", updatedAt: now },
    }),
    database.auditLog.create({ data: {
      id: crypto.randomUUID(), actorUserId: actor.id,
      actionType: parsed.data.decision === "approve" ? "document.removal_approved" : "document.removal_rejected",
      targetEntity: "uploaded_document", targetEntityId: document.id,
      previousValue: JSON.stringify({ status: "removal_requested", originalName: document.originalName, ownerPersonId: document.ownerPersonId, applicationId: document.applicationId }),
      newValue: JSON.stringify({ status: parsed.data.decision === "approve" ? "archived" : "active", archivedAt: parsed.data.decision === "approve" ? now.toISOString() : null }),
      reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
    } }),
  ]);
  return Response.redirect(new URL(`/dashboard/document-requests?success=${parsed.data.decision}`, request.url), 303);
}
