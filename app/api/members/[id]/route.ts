import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { logRuntimeError } from "@/lib/runtime-error";

const memberSchema = z.object({
  membershipStatus: z.enum(["registered_user", "applicant", "reserve", "member", "suspended", "former_member"]),
  branchId: z.string().trim().min(2),
  reason: z.string().trim().min(5).max(1500),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    stage = "authentication";
    const user = await authenticateRequest(request);
    if (!user || !isFullAccess(user)) return new Response("Forbidden", { status: 403 });
    const { id } = await context.params;
    stage = "validation";
    const parsed = memberSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(new URL(`/dashboard/members?error=validation`, request.url), 303);
    stage = "database";
    await ensureDatabase();
    const database = getDb();
    stage = "target_lookup";
    const [current, branch] = await Promise.all([
      database.personProfile.findFirst({ where: { id, archivedAt: null }, select: { membershipStatus: true, branchId: true, membershipStartedAt: true } }),
      database.branch.findFirst({ where: { id: parsed.data.branchId, archivedAt: null }, select: { id: true } }),
    ]);
    if (!current || !branch) return new Response("Not found", { status: 404 });
    const now = new Date();
    stage = "member_transaction";
    await database.$transaction([
      database.personProfile.update({ where: { id }, data: {
        membershipStatus: parsed.data.membershipStatus,
        branchId: parsed.data.branchId,
        membershipStartedAt: parsed.data.membershipStatus === "member" ? (current.membershipStartedAt ?? now) : current.membershipStartedAt,
        updatedAt: now,
      } }),
      database.membershipStatusHistory.create({ data: {
        id: crypto.randomUUID(), personId: id, previousStatus: current.membershipStatus,
        newStatus: parsed.data.membershipStatus, reason: parsed.data.reason,
        visibility: "internal", changedBy: user.id, createdAt: now,
      } }),
      database.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: "member.administrative_update",
        targetEntity: "person_profile", targetEntityId: id,
        previousValue: JSON.stringify({ membershipStatus: current.membershipStatus, branchId: current.branchId }),
        newValue: JSON.stringify({ membershipStatus: parsed.data.membershipStatus, branchId: parsed.data.branchId }),
        reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } }),
    ]);
    return Response.redirect(new URL("/dashboard/members?success=updated", request.url), 303);
  } catch (error) {
    logRuntimeError("member.save.runtime_error", stage, error);
    return Response.redirect(new URL("/dashboard/members?error=unexpected", request.url), 303);
  }
}
