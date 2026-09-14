import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    await ensureDatabase();
    const { id } = await context.params;
    const database = getDb();
    const document = await database.uploadedDocument.findFirst({
      where: { id, ownerPersonId: user.profileId, status: "active", archivedAt: null },
      select: { id: true, objectKey: true, originalName: true, applicationId: true, draftId: true },
    });
    if (!document) return Response.json({ error: "not_found" }, { status: 404 });
    if (document.applicationId || document.draftId) return Response.json({ error: "controlled_document", message: "Өтініш құжатын тиісті өтініш бетінен басқарыңыз." }, { status: 409 });
    await getPrivateObjectStorage().delete(document.objectKey);
    const now = new Date();
    await database.$transaction([
      database.uploadedDocument.update({ where: { id: document.id }, data: { status: "archived", archivedAt: now, updatedAt: now } }),
      database.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: "profile.document_removed",
        targetEntity: "uploaded_document", targetEntityId: document.id,
        previousValue: JSON.stringify({ status: "active", originalName: document.originalName }),
        newValue: JSON.stringify({ status: "archived", archivedAt: now.toISOString() }),
        reason: "Пайдаланушы өтінішке байланыспаған жеке құжатын жойды", ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } }),
    ]);
    return Response.json({ removed: true });
  } catch {
    return Response.json({ error: "unexpected", message: "Құжатты жою мүмкін болмады." }, { status: 500 });
  }
}
