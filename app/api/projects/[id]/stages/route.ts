import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedProject, canManageProjectStages } from "@/lib/authorization";
import { parseProjectStageForm, projectStageStatuses } from "@/lib/projects";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, id: string, ok: boolean, code: string) {
  return Response.redirect(new URL(`/dashboard/projects/${id}?${ok ? "success" : "error"}=${encodeURIComponent(code)}#project-stages`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const project = await database.project.findUnique({ where: { id } });
    if (!project) return new Response("Not found", { status: 404 });
    if (!canAccessManagedProject(actor, project) || !canManageProjectStages(actor, project)) return new Response("Forbidden", { status: 403 });
    if (project.status === "ARCHIVED") return redirect(request, id, false, "archived");
    const form = await request.formData();
    const action = String(form.get("action") ?? "add");
    const now = new Date();

    if (action === "batch-add") {
      const titles = form.getAll("title");
      const descriptions = form.getAll("description");
      const startDates = form.getAll("startDate");
      const endDates = form.getAll("endDate");
      const stageCount = titles.length;
      if (stageCount < 1 || stageCount > 30 || descriptions.length !== stageCount || startDates.length !== stageCount || endDates.length !== stageCount) {
        return redirect(request, id, false, "stage-batch");
      }
      const inputs = titles.map((title, index) => {
        const stageForm = new FormData();
        stageForm.set("title", String(title));
        stageForm.set("description", String(descriptions[index] ?? ""));
        stageForm.set("startDate", String(startDates[index] ?? ""));
        stageForm.set("endDate", String(endDates[index] ?? ""));
        return parseProjectStageForm(stageForm);
      });
      const aggregate = await database.projectStage.aggregate({ where: { projectId: id }, _max: { sortOrder: true } });
      const baseOrder = aggregate._max.sortOrder ?? 0;
      const stages = inputs.map((input, index) => ({
        id: crypto.randomUUID(), projectId: id, ...input, status: "PENDING" as const,
        sortOrder: baseOrder + ((index + 1) * 10), createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now,
      }));
      await database.$transaction([
        database.projectStage.createMany({ data: stages }),
        database.auditLog.createMany({ data: stages.map((stage, index) => ({
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.stage.created", targetEntity: "project_stage", targetEntityId: stage.id,
          newValue: JSON.stringify({ projectId: id, ...inputs[index] }), reason: "Жоба кезеңдері бір ретпен қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        })) }),
      ]);
      return redirect(request, id, true, "stages-added");
    }

    if (action === "add") {
      const input = parseProjectStageForm(form);
      const aggregate = await database.projectStage.aggregate({ where: { projectId: id }, _max: { sortOrder: true } });
      const stageId = crypto.randomUUID();
      await database.$transaction([
        database.projectStage.create({ data: { id: stageId, projectId: id, ...input, status: "PENDING", sortOrder: (aggregate._max.sortOrder ?? 0) + 10, createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now } }),
        database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.stage.created", targetEntity: "project_stage", targetEntityId: stageId, newValue: JSON.stringify({ projectId: id, ...input }), reason: "Жоба кезеңі қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
      ]);
      return redirect(request, id, true, "stage-added");
    }

    const stageId = String(form.get("stageId") ?? "");
    const stage = await database.projectStage.findFirst({ where: { id: stageId, projectId: id } });
    if (!stage) return redirect(request, id, false, "stage-not-found");

    if (action === "update") {
      const input = parseProjectStageForm(form);
      await database.$transaction([
        database.projectStage.update({ where: { id: stageId }, data: { ...input, updatedBy: actor.id, updatedAt: now } }),
        database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.stage.updated", targetEntity: "project_stage", targetEntityId: stageId, previousValue: JSON.stringify(stage), newValue: JSON.stringify(input), reason: "Жоба кезеңі жаңартылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
      ]);
      return redirect(request, id, true, "stage-updated");
    }

    if (action === "status") {
      const status = String(form.get("status") ?? "");
      if (!(projectStageStatuses as readonly string[]).includes(status)) return redirect(request, id, false, "stage-status");
      await database.$transaction([
        database.projectStage.update({ where: { id: stageId }, data: { status, completedAt: status === "COMPLETED" ? now : null, updatedBy: actor.id, updatedAt: now } }),
        database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: `project.stage.status.${status.toLowerCase()}`, targetEntity: "project_stage", targetEntityId: stageId, previousValue: JSON.stringify({ status: stage.status }), newValue: JSON.stringify({ status }), reason: "Жоба кезеңінің мәртебесі өзгертілді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
      ]);
      return redirect(request, id, true, "stage-status");
    }
    return redirect(request, id, false, "action");
  } catch {
    return redirect(request, id, false, "validation");
  }
}
