import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch, canReviewApplications } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const decisionSchema = z.object({
  decision: z.enum(["rejected", "reserve", "approved"]),
  reason: z.string().trim().min(5).max(1500),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user || !canReviewApplications(user)) return new Response("Forbidden", { status: 403 });
    const { id } = await context.params;
    const form = await request.formData();
    const parsed = decisionSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) return Response.redirect(new URL(`/dashboard/applications/${id}?error=validation`, request.url), 303);

    await ensureDatabase();
    const database = getDb();
    const application = await database.membershipApplication.findFirst({
      where: { id, archivedAt: null },
      include: { person: { select: { membershipStatus: true, membershipStartedAt: true, userId: true } } },
    });
    if (!application || !canAccessBranch(user, application.branchId)) return new Response("Forbidden", { status: 403 });
    if (!new Set(["awaiting_review", "reserve"]).has(application.status)) {
      return Response.redirect(new URL(`/dashboard/applications/${id}?error=final`, request.url), 303);
    }

    const membershipStatus = parsed.data.decision === "approved" ? "member" : parsed.data.decision;
    const now = new Date();
    await database.$transaction(async (tx) => {
      await tx.membershipApplication.update({ where: { id }, data: { status: parsed.data.decision, reviewedAt: now, reviewedBy: user.id, decisionReason: parsed.data.reason } });
      await tx.personProfile.update({ where: { id: application.personId }, data: {
        membershipStatus,
        membershipStartedAt: membershipStatus === "member" ? (application.person.membershipStartedAt ?? now) : application.person.membershipStartedAt,
        updatedAt: now,
      } });
      await tx.membershipStatusHistory.create({ data: {
        id: crypto.randomUUID(), personId: application.personId, applicationId: id,
        previousStatus: application.person.membershipStatus, newStatus: membershipStatus,
        reason: parsed.data.reason, visibility: membershipStatus === "member" ? "member" : "internal",
        changedBy: user.id, createdAt: now,
      } });
      await tx.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: `application.${parsed.data.decision}`,
        targetEntity: "membership_application", targetEntityId: id,
        previousValue: JSON.stringify({ applicationStatus: application.status, membershipStatus: application.person.membershipStatus }),
        newValue: JSON.stringify({ applicationStatus: parsed.data.decision, membershipStatus }),
        reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } });
      if (membershipStatus === "member" && application.person.userId) {
        const existingRole = await tx.userRole.findFirst({ where: { userId: application.person.userId, roleId: "role-member", revokedAt: null }, select: { id: true } });
        if (!existingRole) {
          await tx.userRole.create({ data: { id: crypto.randomUUID(), userId: application.person.userId, roleId: "role-member", scopeType: "global", grantedBy: user.id, grantedAt: now } });
        }
      }
    });
    return Response.redirect(new URL(`/dashboard/applications/${id}?success=decision`, request.url), 303);
  } catch {
    return new Response("Unable to record the decision", { status: 400 });
  }
}
