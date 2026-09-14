import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  canManageBranchProjects,
  canManageDepartmentProjects,
  canManageGlobalProjects,
  projectBranchScopeIds,
  projectDepartmentScopeIds,
} from "@/lib/authorization";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { parseProjectForm } from "@/lib/projects";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const form = await request.formData();
    const input = parseProjectForm(form);
    const global = canManageGlobalProjects(actor);
    const allBranchesAllowed = input.projectScope === "ALL_BRANCHES" && global;
    const branchAllowed = input.projectScope === "BRANCH" && canManageBranchProjects(actor) && projectBranchScopeIds(actor).includes(input.branchId!);
    const departmentAllowed = input.projectScope === "NATIONAL" && input.responsibleDepartmentId && canManageDepartmentProjects(actor) && projectDepartmentScopeIds(actor).includes(input.responsibleDepartmentId);
    if (!global && !allBranchesAllowed && !branchAllowed && !departmentAllowed) return new Response("Forbidden", { status: 403 });
    if (!global && input.publicProjectId) return new Response("Forbidden", { status: 403 });

    const database = getDb();
    const now = new Date();
    const id = crypto.randomUUID();
    await database.$transaction(async (transaction) => {
      if (input.branchId && !(await transaction.branch.findFirst({ where: { id: input.branchId, archivedAt: null, status: "active" }, select: { id: true } }))) throw new Error("INVALID_PROJECT:branchId");
      if (input.responsibleDepartmentId && !(await transaction.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_PROJECT:responsibleDepartmentId");
      if (input.leaderProfileId && !(await transaction.personProfile.findFirst({ where: { id: input.leaderProfileId, archivedAt: null, membershipStatus: "member" }, select: { id: true } }))) throw new Error("INVALID_PROJECT:leaderProfileId");
      if (input.publicProjectId && !(await transaction.publicProject.findFirst({ where: { id: input.publicProjectId, archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_PROJECT:publicProjectId");
      const created = await transaction.project.create({ data: { id, ...input, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now } });
      if (input.leaderProfileId) await transaction.projectParticipant.create({ data: {
        id: crypto.randomUUID(), projectId: id, personId: input.leaderProfileId, participantRole: "LEADER", status: "ACTIVE", joinedAt: now, createdBy: actor.id, createdAt: now, updatedAt: now,
      } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.created", targetEntity: "project", targetEntityId: id,
        newValue: serializeAuditValue(created), reason: "Ішкі жоба құрылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    return Response.redirect(new URL(`/dashboard/projects/${id}?success=created`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = message.startsWith("INVALID_PROJECT") || message.includes("Unique constraint") ? "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/projects?error=${code}`, request.url), 303);
  }
}
