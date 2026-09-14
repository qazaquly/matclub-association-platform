import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  canAccessManagedProject,
  canManageBranchProjects,
  canManageDepartmentProjects,
  canManageGlobalProjects,
  projectBranchScopeIds,
  projectDepartmentScopeIds,
} from "@/lib/authorization";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { syncProjectParticipantActivity } from "@/lib/project-activity";
import { allowedProjectTransitions, parseProjectForm } from "@/lib/projects";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, id: string, ok: boolean, code: string) {
  return Response.redirect(new URL(`/dashboard/projects/${id}?${ok ? "success" : "error"}=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const project = await database.project.findUnique({ where: { id }, include: { participants: true } });
    if (!project) return new Response("Not found", { status: 404 });
    if (!canAccessManagedProject(actor, project)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") ?? "update");
    const now = new Date();

    if (action === "update") {
      if (project.status === "ARCHIVED") return redirect(request, id, false, "archived");
      const input = parseProjectForm(form);
      const global = canManageGlobalProjects(actor);
      const allBranchesAllowed = input.projectScope === "ALL_BRANCHES" && global;
      const branchAllowed = input.projectScope === "BRANCH" && canManageBranchProjects(actor) && projectBranchScopeIds(actor).includes(input.branchId!);
      const departmentAllowed = input.projectScope === "NATIONAL" && input.responsibleDepartmentId && canManageDepartmentProjects(actor) && projectDepartmentScopeIds(actor).includes(input.responsibleDepartmentId);
      if (!global && project.leaderProfileId !== actor.profileId && !allBranchesAllowed && !branchAllowed && !departmentAllowed) return new Response("Forbidden", { status: 403 });
      if (!global && (input.publicProjectId !== project.publicProjectId || input.projectScope !== project.projectScope || input.branchId !== project.branchId || input.responsibleDepartmentId !== project.responsibleDepartmentId)) return new Response("Forbidden", { status: 403 });

      await database.$transaction(async (transaction) => {
        if (input.branchId && !(await transaction.branch.findFirst({ where: { id: input.branchId, archivedAt: null, status: "active" }, select: { id: true } }))) throw new Error("INVALID_PROJECT:branchId");
        if (input.responsibleDepartmentId && !(await transaction.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_PROJECT:responsibleDepartmentId");
        if (input.leaderProfileId && !(await transaction.personProfile.findFirst({ where: { id: input.leaderProfileId, archivedAt: null, membershipStatus: "member" }, select: { id: true } }))) throw new Error("INVALID_PROJECT:leaderProfileId");
        const updated = await transaction.project.update({ where: { id }, data: { ...input, updatedBy: actor.id, updatedAt: now } });
        if (project.leaderProfileId && project.leaderProfileId !== input.leaderProfileId) {
          await transaction.projectParticipant.updateMany({ where: { projectId: id, personId: project.leaderProfileId, participantRole: "LEADER" }, data: { participantRole: "PARTICIPANT", updatedAt: now } });
        }
        if (input.leaderProfileId) {
          const leaderParticipant = await transaction.projectParticipant.upsert({
            where: { projectId_personId: { projectId: id, personId: input.leaderProfileId } },
            create: { id: crypto.randomUUID(), projectId: id, personId: input.leaderProfileId, participantRole: "LEADER", status: "ACTIVE", joinedAt: now, createdBy: actor.id, createdAt: now, updatedAt: now },
            update: { participantRole: "LEADER", status: "ACTIVE", completedAt: null, endedAt: null, updatedAt: now },
          });
          await syncProjectParticipantActivity(transaction, leaderParticipant, updated, now);
        }
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.updated", targetEntity: "project", targetEntityId: id,
          previousValue: serializeAuditValue(project), newValue: serializeAuditValue(updated), reason: "Жоба деректері жаңартылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return redirect(request, id, true, "updated");
    }

    if (action === "status") {
      const nextStatus = String(form.get("status") ?? "");
      if (!allowedProjectTransitions(project.status).includes(nextStatus)) return redirect(request, id, false, "transition");
      const reason = String(form.get("reason") ?? "").trim().slice(0, 2_000) || null;
      await database.$transaction(async (transaction) => {
        const updated = await transaction.project.update({ where: { id }, data: {
          status: nextStatus, statusNote: reason, archivedAt: nextStatus === "ARCHIVED" ? now : null, updatedBy: actor.id, updatedAt: now,
        } });
        if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") {
          for (const current of project.participants.filter((item) => item.status === "ACTIVE")) {
            const participant = await transaction.projectParticipant.update({ where: { id: current.id }, data: nextStatus === "COMPLETED"
              ? { status: "COMPLETED", completedAt: now, endedAt: now, updatedAt: now }
              : { status: "WITHDRAWN", endedAt: now, completedAt: null, updatedAt: now },
            });
            await syncProjectParticipantActivity(transaction, participant, project, now);
          }
        }
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: `project.status.${nextStatus.toLowerCase()}`, targetEntity: "project", targetEntityId: id,
          previousValue: JSON.stringify({ status: project.status }), newValue: JSON.stringify({ status: nextStatus }), reason: reason ?? "Жоба мәртебесі өзгертілді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
        void updated;
      });
      return redirect(request, id, true, nextStatus.toLowerCase());
    }

    return redirect(request, id, false, "action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return redirect(request, id, false, message.startsWith("INVALID_PROJECT") || message.includes("Unique constraint") ? "validation" : "unexpected");
  }
}
