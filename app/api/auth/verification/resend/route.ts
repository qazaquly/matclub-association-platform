import { ensureDatabase } from "@/db/bootstrap";
import { checkRateLimit } from "@/db/queries";
import { issueEmailVerification } from "@/lib/account-tokens";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.redirect(new URL("/login", request.url), 303);
    if (user.emailVerifiedAt) return Response.redirect(new URL("/membership", request.url), 303);
    await ensureDatabase();
    const allowed = await checkRateLimit(`account:verify:resend:${user.id}:${clientIp(request)}`, 3, 3600);
    if (!allowed) return Response.redirect(new URL("/verify-email?state=rate-limited", request.url), 303);
    const result = await issueEmailVerification(user.id, user.email, request.url);
    return Response.redirect(new URL(`/verify-email?state=${result.delivered ? "sent" : "unconfigured"}`, request.url), 303);
  } catch {
    return Response.redirect(new URL("/verify-email?state=failed", request.url), 303);
  }
}
