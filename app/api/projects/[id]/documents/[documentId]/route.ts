import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedProject, canManageProjectDocuments } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const actor = await authenticateRequest(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id, documentId } = await params;
  const record = await getDb().projectDocument.findFirst({ where: { id: documentId, projectId: id, status: "active" }, include: { project: true } });
  if (!record || !canAccessManagedProject(actor, record.project)) return new Response("Forbidden", { status: 403 });
  const object = await getPrivateObjectStorage().get(record.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": record.mimeType,
    "Content-Disposition": `attachment; filename="${record.originalName.replace(/[\r\n"]/g, "_")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const record = await database.projectDocument.findFirst({ where: { id: documentId, projectId: id, status: "active" }, include: { project: true } });
    if (!record) return new Response("Not found", { status: 404 });
    if (!canAccessManagedProject(actor, record.project) || !canManageProjectDocuments(actor, record.project)) return new Response("Forbidden", { status: 403 });
    const now = new Date();
    await database.$transaction([
      database.projectDocument.update({ where: { id: documentId }, data: { status: "archived", archivedAt: now, updatedAt: now } }),
      database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.document.archived", targetEntity: "project_document", targetEntityId: documentId, previousValue: JSON.stringify({ status: record.status, name: record.originalName }), newValue: JSON.stringify({ status: "archived", archivedAt: now.toISOString() }), reason: "Жоба құжаты архивке жіберілді; файл автоматты өшірілмейді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
    ]);
    return Response.redirect(new URL(`/dashboard/projects/${id}?success=document-archived#project-documents`, request.url), 303);
  } catch {
    return Response.redirect(new URL(`/dashboard/projects/${id}?error=document-archive#project-documents`, request.url), 303);
  }
}
