import { ensureDatabase } from "@/db/bootstrap";
import { checkRateLimit, recordAudit } from "@/db/queries";
import { getDb } from "@/db";
import { verifyPasswordInDatabase } from "@/db/password";
import { assertSameOrigin, clientIp, createSessionToken, sessionCookie } from "@/lib/security";

export async function POST(request: Request) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const ipAddress = clientIp(request);
    stage = "rate_limit";
    if (!email || !password || !(await checkRateLimit(`login:${ipAddress}:${email}`, 5, 900))) {
      return Response.redirect(new URL("/login?error=credentials", request.url), 303);
    }

    stage = "database_lookup";
    await ensureDatabase();
    const database = getDb();
    const user = await database.user.findFirst({
      where: { email, status: "active", archivedAt: null },
      select: { id: true, passwordHash: true, emailVerifiedAt: true, profile: { select: { membershipStatus: true } } },
    });
    if (!user?.passwordHash) {
      return Response.redirect(new URL("/login?error=credentials", request.url), 303);
    }

    stage = "password_verification";
    if (!(await verifyPasswordInDatabase(database, password, user.passwordHash))) {
      return Response.redirect(new URL("/login?error=credentials", request.url), 303);
    }

    stage = "session_signing";
    const token = await createSessionToken(user.id);
    stage = "last_login_update";
    await database.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    stage = "login_audit";
    await recordAudit({
      actorUserId: user.id,
      actionType: "auth.login",
      targetEntity: "user",
      targetEntityId: user.id,
      ipAddress,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL(!user.emailVerifiedAt ? "/verify-email" : user.profile?.membershipStatus === "registered_user" ? "/membership" : "/dashboard", request.url).toString(),
        "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"),
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "auth.login.runtime_error",
      stage,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }));
    return Response.redirect(new URL("/login?error=unexpected", request.url), 303);
  }
}
