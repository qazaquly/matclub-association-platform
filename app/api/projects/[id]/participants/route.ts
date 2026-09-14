import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedProject, canManageGlobalProjects, canManageProjectParticipants, projectBranchScopeIds } from "@/lib/authorization";
import { syncProjectParticipantActivity } from "@/lib/project-activity";
import { projectParticipantRoles, projectParticipantStatuses } from "@/lib/projects";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, id: string, ok: boolean, code: string) {
  return Response.redirect(new URL(`/dashboard/projects/${id}?${ok ? "success" : "error"}=${encodeURIComponent(code)}#project-participants`, request.url), 303);
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
    if (!canAccessManagedProject(actor, project) || !canManageProjectParticipants(actor, project)) return new Response("Forbidden", { status: 403 });
    if (project.status === "ARCHIVED") return redirect(request, id, false, "archived");
    const form = await request.formData();
    const action = String(form.get("action") ?? "add");
    const now = new Date();

    if (action === "add") {
      const personId = String(form.get("personId") ?? "");
      const participantRole = String(form.get("participantRole") ?? "PARTICIPANT");
      if (!(projectParticipantRoles as readonly string[]).includes(participantRole)) return redirect(request, id, false, "role");
      const person = await database.personProfile.findFirst({
        where: { id: personId, archivedAt: null, membershipStatus: "member" },
        include: { departmentAssignments: { where: { endedAt: null }, select: { departmentId: true } } },
      });
      const inScope = person && (canManageGlobalProjects(actor)
        || (project.projectScope === "ALL_BRANCHES" && person.branchId != null && projectBranchScopeIds(actor).includes(person.branchId))
        || (project.branchId ? person.branchId === project.branchId : project.responsibleDepartmentId ? person.departmentAssignments.some((item) => item.departmentId === project.responsibleDepartmentId) : person.id === actor.profileId));
      if (!person || !inScope) return redirect(request, id, false, "person");
      const participantId = crypto.randomUUID();
      await database.$transaction([
        database.projectParticipant.create({ data: { id: participantId, projectId: id, personId, participantRole: personId === project.leaderProfileId ? "LEADER" : participantRole, status: "ACTIVE", joinedAt: now, createdBy: actor.id, createdAt: now, updatedAt: now } }),
        database.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: "project.participant.added", targetEntity: "project_participant", targetEntityId: participantId, newValue: JSON.stringify({ projectId: id, personId, participantRole }), reason: "Жобаға мүше қосылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } }),
      ]);
      return redirect(request, id, true, "participant-added");
    }

    if (action !== "update") return redirect(request, id, false, "action");
    const participantId = String(form.get("participantId") ?? "");
    const participant = await database.projectParticipant.findFirst({ where: { id: participantId, projectId: id } });
    if (!participant) return redirect(request, id, false, "participant-not-found");
    const participantRole = String(form.get("participantRole") ?? participant.participantRole);
    const status = String(form.get("status") ?? participant.status);
    const notes = String(form.get("notes") ?? participant.notes ?? "").trim().slice(0, 2_000) || null;
    if (!(projectParticipantRoles as readonly string[]).includes(participantRole) || !(projectParticipantStatuses as readonly string[]).includes(status)) return redirect(request, id, false, "participant");
    if (participant.personId === project.leaderProfileId && (participantRole !== "LEADER" || status !== "ACTIVE")) return redirect(request, id, false, "leader");
    const completedAt = status === "COMPLETED" ? (participant.completedAt ?? now) : null;
    const endedAt = status === "ACTIVE" ? null : (participant.endedAt ?? now);
    await database.$transaction(async (transaction) => {
      const updated = await transaction.projectParticipant.update({ where: { id: participantId }, data: { participantRole, status, notes, completedAt, endedAt, updatedAt: now } });
      await syncProjectParticipantActivity(transaction, updated, project, now);
      await transaction.auditLog.create({ data: { id: crypto.randomUUID(), actorUserId: actor.id, actionType: `project.participant.${status.toLowerCase()}`, targetEntity: "project_participant", targetEntityId: participantId, previousValue: JSON.stringify(participant), newValue: JSON.stringify(updated), reason: "Жоба қатысушысының дерегі жаңартылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now } });
    });
    return redirect(request, id, true, "participant-updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return redirect(request, id, false, message.includes("Unique constraint") ? "duplicate" : "unexpected");
  }
}
