import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canReopenApplication } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const reopenSchema = z.object({
  reason: z.string().trim().min(5).max(1500),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user || !canReopenApplication(user)) return new Response("Forbidden", { status: 403 });

    const { id } = await context.params;
    const parsed = reopenSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) {
      return Response.redirect(new URL(`/dashboard/applications/${id}?error=validation`, request.url), 303);
    }

    await ensureDatabase();
    const database = getDb();
    const application = await database.membershipApplication.findFirst({
      where: { id, archivedAt: null },
      include: {
        person: { select: { membershipStatus: true } },
        reviewer: { select: { id: true } },
      },
    });
    if (!application) return new Response("Not found", { status: 404 });
    if (application.status !== "rejected") {
      return Response.redirect(new URL(`/dashboard/applications/${id}?error=not_rejected`, request.url), 303);
    }

    const now = new Date();
    await database.$transaction(async (tx) => {
      const claimed = await tx.membershipApplication.updateMany({
        where: { id, status: "rejected", archivedAt: null },
        data: {
          status: "awaiting_review",
          reviewedAt: null,
          reviewedBy: null,
          decisionReason: null,
        },
      });
      if (claimed.count !== 1) throw new Error("Application is no longer rejected");
      await tx.personProfile.update({
        where: { id: application.personId },
        data: { membershipStatus: "applicant", updatedAt: now },
      });
      await tx.membershipStatusHistory.create({
        data: {
          id: crypto.randomUUID(),
          personId: application.personId,
          applicationId: id,
          previousStatus: application.person.membershipStatus,
          newStatus: "applicant",
          reason: parsed.data.reason,
          visibility: "internal",
          changedBy: user.id,
          createdAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          actorUserId: user.id,
          actionType: "application.reopened",
          targetEntity: "membership_application",
          targetEntityId: id,
          previousValue: JSON.stringify({
            applicationStatus: application.status,
            membershipStatus: application.person.membershipStatus,
            reviewedAt: application.reviewedAt?.toISOString() ?? null,
            reviewedBy: application.reviewer?.id ?? null,
            decisionReason: application.decisionReason,
          }),
          newValue: JSON.stringify({ applicationStatus: "awaiting_review", membershipStatus: "applicant" }),
          reason: parsed.data.reason,
          ipAddress: clientIp(request),
          sessionId: user.sessionId,
          createdAt: now,
        },
      });
    });

    return Response.redirect(new URL(`/dashboard/applications/${id}?success=reopened`, request.url), 303);
  } catch {
    return new Response("Unable to reopen the application", { status: 400 });
  }
}
