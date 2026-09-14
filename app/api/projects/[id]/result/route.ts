import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedProject, canManageProjectResults } from "@/lib/authorization";
import { parseProjectResultForm } from "@/lib/projects";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const project = await database.project.findUnique({ where: { id }, include: { result: true } });
    if (!project) return new Response("Not found", { status: 404 });
    if (!canAccessManagedProject(actor, project) || !canManageProjectResults(actor, project)) return new Response("Forbidden", { status: 403 });
    if (project.status === "ARCHIVED") return Response.redirect(new URL(`/dashboard/projects/${id}?error=archived#project-result`, request.url), 303);
    const input = parseProjectResultForm(await request.formData());
    const now = new Date();
    await database.$transaction([
      database.projectResult.upsert({ where: { projectId: id }, create: { projectId: id, ...input, updatedBy: actor.id, createdAt: now, updatedAt: now }, update: { ...input, updatedBy: actor.id, updatedAt: now } }),
      database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.result.saved", targetEntity: "project_result", targetEntityId: id, previousValue: project.result ? JSON.stringify(project.result) : null, newValue: JSON.stringify(input), reason: "Жоба нәтижесі сақталды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
    ]);
    return Response.redirect(new URL(`/dashboard/projects/${id}?success=result-saved#project-result`, request.url), 303);
  } catch {
    return Response.redirect(new URL(`/dashboard/projects/${id}?error=result-validation#project-result`, request.url), 303);
  }
}
