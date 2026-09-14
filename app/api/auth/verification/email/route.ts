import { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { checkRateLimit } from "@/db/queries";
import { issueEmailVerification } from "@/lib/account-tokens";
import { emailAddressSchema } from "@/lib/account-validation";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.redirect(new URL("/login", request.url), 303);
    if (user.emailVerifiedAt) return Response.redirect(new URL("/membership", request.url), 303);
    await ensureDatabase();
    if (!(await checkRateLimit(`account:verify:email-change:${user.id}:${clientIp(request)}`, 5, 3600))) {
      return Response.redirect(new URL("/verify-email?state=rate-limited", request.url), 303);
    }
    const form = await request.formData();
    const parsed = emailAddressSchema.safeParse(form.get("email"));
    if (!parsed.success) return Response.redirect(new URL("/verify-email?state=invalid-email", request.url), 303);
    if (parsed.data === user.email) return Response.redirect(new URL("/verify-email?state=email-unchanged", request.url), 303);

    const database = getDb();
    const now = new Date();
    try {
      await database.$transaction(async (transaction) => {
        const current = await transaction.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true } });
        if (!current || current.emailVerifiedAt) throw new Error("EMAIL_ALREADY_VERIFIED");
        await transaction.user.update({ where: { id: user.id }, data: { email: parsed.data, updatedAt: now } });
        await transaction.personProfile.update({ where: { id: user.profileId }, data: { email: parsed.data, updatedAt: now } });
        await transaction.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: user.id, actionType: "account.unverified_email_changed",
          targetEntity: "user", targetEntityId: user.id,
          previousValue: JSON.stringify({ email: current.email }), newValue: JSON.stringify({ email: parsed.data }),
          reason: "Расталмаған электрондық пошта пайдаланушы сұрауымен түзетілді",
          ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
        } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return Response.redirect(new URL("/verify-email?state=email-in-use", request.url), 303);
      }
      if (error instanceof Error && error.message === "EMAIL_ALREADY_VERIFIED") {
        return Response.redirect(new URL("/membership", request.url), 303);
      }
      throw error;
    }

    const result = await issueEmailVerification(user.id, parsed.data, request.url);
    return Response.redirect(new URL(`/verify-email?state=${result.delivered ? "email-updated" : "email-updated-unconfigured"}`, request.url), 303);
  } catch {
    return Response.redirect(new URL("/verify-email?state=failed", request.url), 303);
  }
}
