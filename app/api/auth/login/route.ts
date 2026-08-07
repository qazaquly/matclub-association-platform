import { ensureDatabase } from "@/db/bootstrap";
import { checkRateLimit, recordAudit } from "@/db/queries";
import { getRawDb } from "@/db";
import { assertSameOrigin, clientIp, createSessionToken, sessionCookie, verifyPassword } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const ipAddress = clientIp(request);
    if (!email || !password || !(await checkRateLimit(`login:${ipAddress}:${email}`, 5, 900))) {
      return Response.redirect(new URL("/login?error=credentials", request.url), 303);
    }

    await ensureDatabase();
    const database = getRawDb();
    const user = await database
      .prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ? AND status = 'active' AND archived_at IS NULL")
      .bind(email)
      .first<{ id: string; passwordHash: string | null }>();
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return Response.redirect(new URL("/login?error=credentials", request.url), 303);
    }

    const token = await createSessionToken(user.id);
    await database.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), new Date().toISOString(), user.id).run();
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
        Location: new URL("/dashboard", request.url).toString(),
        "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"),
      },
    });
  } catch {
    return Response.redirect(new URL("/login?error=unexpected", request.url), 303);
  }
}
