import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageInstitutionalDocument } from "@/lib/authorization";
import { parseInstitutionalDocumentUpload, validInstitutionalDocumentSignature } from "@/lib/institutional-documents";
import { assertSameOrigin, clientIp, sha256Hex } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let objectKey: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const document = await database.institutionalDocument.findUnique({ where: { id } });
    if (!document) return new Response("Not found", { status: 404 });
    if (!canManageInstitutionalDocument(actor, document)) return new Response("Forbidden", { status: 403 });
    if (document.status === "ARCHIVED") return Response.redirect(new URL(`/dashboard/documents/${id}?error=archived`, request.url), 303);
    const form = await request.formData();
    const { file, changeNote } = parseInstitutionalDocumentUpload(form);
    if (!changeNote) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:changeNote");
    const body = await file.arrayBuffer();
    if (!validInstitutionalDocumentSignature(file.type, body)) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:signature");
    const versionId = crypto.randomUUID();
    objectKey = `institutional-documents/${id}/versions/${versionId}`;
    await getPrivateObjectStorage().put(objectKey, body);
    const now = new Date();
    await database.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "institutional_documents" WHERE "id" = ${id} FOR UPDATE`);
      const latest = await transaction.institutionalDocumentVersion.aggregate({ where: { documentId: id }, _max: { versionNumber: true } });
      const versionNumber = (latest._max.versionNumber ?? 0) + 1;
      await transaction.institutionalDocumentVersion.create({ data: {
        id: versionId, documentId: id, versionNumber, objectKey: objectKey!, originalName: file.name.slice(0, 240), mimeType: file.type,
        sizeBytes: file.size, checksumSha256: await sha256Hex(body), changeNote, uploadedBy: actor.id, createdAt: now,
      } });
      await transaction.institutionalDocument.update({ where: { id }, data: { updatedBy: actor.id, updatedAt: now } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "institutional_document.version_added", targetEntity: "institutional_document", targetEntityId: id,
        newValue: JSON.stringify({ versionNumber, originalName: file.name, mimeType: file.type, sizeBytes: file.size, changeNote }), reason: "Ресми құжаттың жаңа нұсқасы қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    objectKey = null;
    return Response.redirect(new URL(`/dashboard/documents/${id}?success=version`, request.url), 303);
  } catch {
    return Response.redirect(new URL(`/dashboard/documents/${id}?error=version`, request.url), 303);
  } finally {
    if (objectKey) await getPrivateObjectStorage().delete(objectKey).catch(() => undefined);
  }
}
