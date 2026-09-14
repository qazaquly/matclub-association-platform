import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { getUserAccessSnapshot, isProtectedGlobalRole, lockAccessGovernance, protectedGlobalRoleSlugs } from "@/lib/access-governance";
import { authenticateRequest } from "@/lib/auth";
import { canManageRoles } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const roleSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    userId: z.string().min(1),
    roleId: z.string().min(1),
    scopeId: z.string().optional().default(""),
    reason: z.string().trim().max(500).optional().default(""),
  }),
  z.object({
    action: z.literal("revoke"),
    assignmentId: z.string().min(1),
    reason: z.string().trim().max(500).optional().default(""),
  }),
]);

class GovernanceError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export async function POST(request: Request) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !canManageRoles(actor)) return new Response("Forbidden", { status: 403 });
  const parsed = roleSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL("/dashboard/access?error=validation", request.url), 303);
  await ensureDatabase();
  const database = getDb();
  const now = new Date();
  const data = parsed.data;

  try {
    if (data.action === "grant") {
      await database.$transaction(async (tx) => {
        await lockAccessGovernance(tx);
        const [role, target] = await Promise.all([
          tx.role.findUnique({ where: { id: data.roleId }, select: { id: true, slug: true } }),
          tx.user.findFirst({ where: { id: data.userId, status: "active", archivedAt: null }, select: { id: true } }),
        ]);
        if (!role || !target) throw new GovernanceError("not-found");

        const scopeType = role.slug.startsWith("branch_")
          ? "branch"
          : role.slug.startsWith("department_") || role.slug === "vice_president_1"
            ? "department"
            : "global";
        const scopeId = scopeType === "global" ? null : data.scopeId || null;
        if (scopeType !== "global" && !scopeId) throw new GovernanceError("scope");
        if (scopeType === "branch" && !(await tx.branch.findFirst({ where: { id: scopeId!, archivedAt: null }, select: { id: true } }))) {
          throw new GovernanceError("scope");
        }
        if (scopeType === "department" && !(await tx.department.findFirst({ where: { id: scopeId!, archivedAt: null }, select: { id: true } }))) {
          throw new GovernanceError("scope");
        }
        if (await tx.userRole.findFirst({
          where: { userId: target.id, roleId: role.id, scopeType, scopeId, revokedAt: null },
          select: { id: true },
        })) throw new GovernanceError("duplicate");

        const previousAccess = await getUserAccessSnapshot(tx, target.id);
        const assignmentId = crypto.randomUUID();
        await tx.userRole.create({
          data: { id: assignmentId, userId: target.id, roleId: role.id, scopeType, scopeId, grantedBy: actor.id, grantedAt: now },
        });
        const newAccess = await getUserAccessSnapshot(tx, target.id);
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            actorUserId: actor.id,
            actionType: "role.granted",
            targetEntity: "user_access",
            targetEntityId: target.id,
            previousValue: JSON.stringify(previousAccess),
            newValue: JSON.stringify(newAccess),
            reason: data.reason || "Жүйелік рөл мен қолжетімділік берілді",
            ipAddress: clientIp(request),
            sessionId: actor.sessionId,
            createdAt: now,
          },
        });
      });
    } else {
      await database.$transaction(async (tx) => {
        await lockAccessGovernance(tx);
        const assignment = await tx.userRole.findFirst({
          where: { id: data.assignmentId, revokedAt: null },
          include: { role: { select: { slug: true } } },
        });
        if (!assignment) throw new GovernanceError("not-found");
        if (assignment.userId === actor.id && isProtectedGlobalRole(assignment.role.slug)) throw new GovernanceError("self");

        if (isProtectedGlobalRole(assignment.role.slug)) {
          const remainingGlobalAdministrators = await tx.userRole.count({
            where: {
              id: { not: assignment.id },
              revokedAt: null,
              role: { slug: { in: [...protectedGlobalRoleSlugs] } },
              user: { status: "active", archivedAt: null },
            },
          });
          if (remainingGlobalAdministrators === 0) throw new GovernanceError("last-admin");
        }

        const previousAccess = await getUserAccessSnapshot(tx, assignment.userId);
        await tx.userRole.update({ where: { id: assignment.id }, data: { revokedAt: now } });
        const newAccess = await getUserAccessSnapshot(tx, assignment.userId);
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            actorUserId: actor.id,
            actionType: "role.revoked",
            targetEntity: "user_access",
            targetEntityId: assignment.userId,
            previousValue: JSON.stringify(previousAccess),
            newValue: JSON.stringify(newAccess),
            reason: data.reason || "Жүйелік рөл мен қолжетімділік қайтарылды",
            ipAddress: clientIp(request),
            sessionId: actor.sessionId,
            createdAt: now,
          },
        });
      });
    }
  } catch (error) {
    if (error instanceof GovernanceError) {
      if (error.code === "not-found") return new Response("Not found", { status: 404 });
      return Response.redirect(new URL(`/dashboard/access?error=${error.code}`, request.url), 303);
    }
    throw error;
  }

  return Response.redirect(new URL("/dashboard/access?success=updated", request.url), 303);
}
