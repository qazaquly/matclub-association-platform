import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { checkRateLimit } from "@/db/queries";
import { issuePasswordReset } from "@/lib/account-tokens";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureDatabase();
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const generic = new URL("/forgot-password?state=sent", request.url);
    if (!email || !email.includes("@")) return Response.redirect(generic, 303);
    const allowed = await checkRateLimit(`account:reset:request:${clientIp(request)}:${email}`, 3, 3600);
    if (!allowed) return Response.redirect(generic, 303);
    const user = await getDb().user.findFirst({ where: { email, status: "active", archivedAt: null }, select: { id: true, email: true } });
    if (user) {
      try { await issuePasswordReset(user.id, user.email, request.url); } catch { /* Keep enumeration-safe response. */ }
    }
    return Response.redirect(generic, 303);
  } catch {
    return Response.redirect(new URL("/forgot-password?state=sent", request.url), 303);
  }
}

