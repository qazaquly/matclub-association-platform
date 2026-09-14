import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch, canReviewApplications, isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const noteSchema = z.object({
  note: z.string().trim().min(3).max(2000),
  visibility: z.enum(["branch", "central"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const user = await authenticateRequest(request);
  if (!user || !canReviewApplications(user)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = noteSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success || (parsed.data.visibility === "central" && !isFullAccess(user))) {
    return Response.redirect(new URL(`/dashboard/applications/${id}?error=note`, request.url), 303);
  }
  await ensureDatabase();
  const database = getDb();
  const application = await database.membershipApplication.findFirst({ where: { id, archivedAt: null }, select: { personId: true, branchId: true } });
  if (!application || !canAccessBranch(user, application.branchId)) return new Response("Forbidden", { status: 403 });
  const now = new Date();
  await database.$transaction([
    database.internalNote.create({ data: {
      id: crypto.randomUUID(), personId: application.personId, applicationId: id,
      branchId: application.branchId, authorUserId: user.id, note: parsed.data.note,
      visibility: parsed.data.visibility, createdAt: now,
    } }),
    database.auditLog.create({ data: {
      id: crypto.randomUUID(), actorUserId: user.id, actionType: "internal_note.created",
      targetEntity: "membership_application", targetEntityId: id,
      newValue: JSON.stringify({ visibility: parsed.data.visibility }), ipAddress: clientIp(request),
      sessionId: user.sessionId, createdAt: now,
    } }),
  ]);
  return Response.redirect(new URL(`/dashboard/applications/${id}?success=note`, request.url), 303);
}
