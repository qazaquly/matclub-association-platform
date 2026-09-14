import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { getPersonDepartmentAccessSnapshot, lockAccessGovernance } from "@/lib/access-governance";
import { authenticateRequest } from "@/lib/auth";
import { canManageRoles } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const assignmentSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), personId: z.string().min(1), departmentId: z.string().min(1), reason: z.string().trim().max(500).optional().default("") }),
  z.object({ action: z.literal("revoke"), assignmentId: z.string().min(1), reason: z.string().trim().max(500).optional().default("") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor || !canManageRoles(actor)) return new Response("Forbidden", { status: 403 });
    const parsed = assignmentSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(new URL("/dashboard/access?error=department", request.url), 303);
    await ensureDatabase();
    const database = getDb();
    const now = new Date();
    const data = parsed.data;

    if (data.action === "grant") {
      await database.$transaction(async (tx) => {
        await lockAccessGovernance(tx);
        const [person, department, existing] = await Promise.all([
          tx.personProfile.findFirst({ where: { id: data.personId, archivedAt: null }, select: { id: true, userId: true } }),
          tx.department.findFirst({ where: { id: data.departmentId, archivedAt: null }, select: { id: true } }),
          tx.personDepartmentAssignment.findFirst({ where: { personId: data.personId, departmentId: data.departmentId, endedAt: null }, select: { id: true } }),
        ]);
        if (!person || !department) throw new Error("NOT_FOUND");
        if (existing) throw new Error("DUPLICATE");
        const previousAccess = await getPersonDepartmentAccessSnapshot(tx, person.id);
        const assignmentId = crypto.randomUUID();
        await tx.personDepartmentAssignment.create({ data: {
          id: assignmentId, personId: person.id, departmentId: department.id,
          assignedBy: actor.id, assignedAt: now,
        } });
        const newAccess = await getPersonDepartmentAccessSnapshot(tx, person.id);
        await tx.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "department.assignment_granted",
          targetEntity: "person_access", targetEntityId: person.userId ?? person.id,
          previousValue: JSON.stringify(previousAccess), newValue: JSON.stringify(newAccess),
          reason: data.reason || "Департаментке ішкі тағайындау", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
    } else {
      await database.$transaction(async (tx) => {
        await lockAccessGovernance(tx);
        const assignment = await tx.personDepartmentAssignment.findFirst({
          where: { id: data.assignmentId, endedAt: null },
          include: { person: { select: { userId: true } } },
        });
        if (!assignment) throw new Error("NOT_FOUND");
        const previousAccess = await getPersonDepartmentAccessSnapshot(tx, assignment.personId);
        await tx.personDepartmentAssignment.update({ where: { id: assignment.id }, data: { endedBy: actor.id, endedAt: now } });
        const newAccess = await getPersonDepartmentAccessSnapshot(tx, assignment.personId);
        await tx.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "department.assignment_revoked",
          targetEntity: "person_access", targetEntityId: assignment.person.userId ?? assignment.personId,
          previousValue: JSON.stringify(previousAccess), newValue: JSON.stringify(newAccess),
          reason: data.reason || "Департамент тағайындауы аяқталды",
          ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
    }
    return Response.redirect(new URL("/dashboard/access?success=department", request.url), 303);
  } catch {
    return Response.redirect(new URL("/dashboard/access?error=department", request.url), 303);
  }
}
