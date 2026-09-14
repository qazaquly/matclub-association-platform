import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedProject, canManageProjectDocuments } from "@/lib/authorization";
import { allowedProjectDocumentTypes, maximumProjectDocumentBytes, parseProjectDocumentCategory, validProjectDocumentSignature } from "@/lib/project-documents";
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
    const project = await database.project.findUnique({ where: { id } });
    if (!project) return new Response("Not found", { status: 404 });
    if (!canAccessManagedProject(actor, project) || !canManageProjectDocuments(actor, project)) return new Response("Forbidden", { status: 403 });
    if (project.status === "ARCHIVED") return Response.redirect(new URL(`/dashboard/projects/${id}?error=archived#project-documents`, request.url), 303);
    const form = await request.formData();
    const document = form.get("document");
    const category = parseProjectDocumentCategory(form.get("category"));
    if (!document || typeof document === "string" || document.size < 1 || document.size > maximumProjectDocumentBytes || !allowedProjectDocumentTypes.has(document.type)) throw new Error("INVALID_PROJECT_DOCUMENT:file");
    const body = await document.arrayBuffer();
    if (!validProjectDocumentSignature(document.type, body)) throw new Error("INVALID_PROJECT_DOCUMENT:signature");
    const documentId = crypto.randomUUID();
    objectKey = `projects/${id}/${documentId}`;
    await getPrivateObjectStorage().put(objectKey, body);
    const now = new Date();
    await database.$transaction([
      database.projectDocument.create({ data: { id: documentId, projectId: id, category, objectKey, originalName: document.name.slice(0, 240), mimeType: document.type, sizeBytes: document.size, checksumSha256: await sha256Hex(body), status: "active", uploadedBy: actor.id, createdAt: now, updatedAt: now } }),
      database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.document.uploaded", targetEntity: "project_document", targetEntityId: documentId, newValue: JSON.stringify({ projectId: id, category, name: document.name, mimeType: document.type, sizeBytes: document.size }), reason: "Жобаға жеке құжат жүктелді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
    ]);
    objectKey = null;
    return Response.redirect(new URL(`/dashboard/projects/${id}?success=document-uploaded#project-documents`, request.url), 303);
  } catch {
    return Response.redirect(new URL(`/dashboard/projects/${id}?error=document-validation#project-documents`, request.url), 303);
  } finally {
    if (objectKey) await getPrivateObjectStorage().delete(objectKey).catch(() => undefined);
  }
}
