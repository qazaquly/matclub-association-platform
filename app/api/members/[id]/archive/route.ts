import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { lockAccessGovernance, protectedGlobalRoleSlugs } from "@/lib/access-governance";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const schema = z.object({ reason: z.string().trim().min(5).max(500) });

class ArchiveError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !isFullAccess(actor)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL(`/dashboard/members/${id}?error=validation`, request.url), 303);
  await ensureDatabase();
  const database = getDb();
  const now = new Date();

  try {
    await database.$transaction(async (tx) => {
      await lockAccessGovernance(tx);
      const target = await tx.personProfile.findFirst({
        where: { id, archivedAt: null },
        include: { user: { include: { roleAssignments: { where: { revokedAt: null }, include: { role: true } } } } },
      });
      if (!target) throw new ArchiveError("not-found");
      if (target.userId === actor.id) throw new ArchiveError("self");
      if (target.user?.roleAssignments.some((assignment) => (protectedGlobalRoleSlugs as readonly string[]).includes(assignment.role.slug))) {
        throw new ArchiveError("protected");
      }
      const previousValue = {
        userStatus: target.user?.status ?? null,
        membershipStatus: target.membershipStatus,
        branchId: target.branchId,
      };
      if (target.userId) {
        await tx.user.update({ where: { id: target.userId }, data: { status: "archived", archivedAt: now, updatedAt: now } });
        await tx.userRole.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.branchStaff.updateMany({ where: { userId: target.userId, activeTo: null }, data: { activeTo: now } });
      }
      await tx.branch.updateMany({ where: { directorProfileId: target.id }, data: { directorProfileId: null, updatedAt: now } });
      await tx.personDepartmentAssignment.updateMany({ where: { personId: target.id, endedAt: null }, data: { endedAt: now, endedBy: actor.id } });
      await tx.personProfessionalCategoryAssignment.updateMany({ where: { personId: target.id, removedAt: null }, data: { removedAt: now, removedBy: actor.id } });
      await tx.membershipApplication.updateMany({ where: { personId: target.id, archivedAt: null }, data: { archivedAt: now } });
      await tx.uploadedDocument.updateMany({ where: { ownerPersonId: target.id, archivedAt: null }, data: { status: "archived", archivedAt: now, updatedAt: now } });
      await tx.personProfile.update({ where: { id: target.id }, data: { archivedAt: now, updatedAt: now } });
      await tx.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "person_profile.archived",
        targetEntity: "person_profile", targetEntityId: target.id,
        previousValue: JSON.stringify(previousValue),
        newValue: JSON.stringify({ archivedAt: now.toISOString(), accountDisabled: Boolean(target.userId) }),
        reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
  } catch (error) {
    if (error instanceof ArchiveError) {
      if (error.code === "not-found") return new Response("Not found", { status: 404 });
      return Response.redirect(new URL(`/dashboard/members/${id}?error=${error.code}`, request.url), 303);
    }
    throw error;
  }
  return Response.redirect(new URL("/dashboard/members?success=archived", request.url), 303);
}
