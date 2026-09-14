import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { hashPasswordInDatabase } from "@/db/password";
import { resetPasswordSchema, validationErrors } from "@/lib/account-validation";
import { tokenHash } from "@/lib/account-tokens";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureDatabase();
    const input = await request.json() as Record<string, unknown>;
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) return Response.json({ errors: validationErrors(parsed.error) }, { status: 422 });
    const database = getDb();
    const hash = await tokenHash(parsed.data.token);
    const reset = await database.passwordResetToken.findFirst({ where: { tokenHash: hash, usedAt: null }, select: { userId: true } });
    if (!reset) {
      return Response.json({ error: "invalid_token", message: "Қалпына келтіру сілтемесі жарамсыз немесе мерзімі аяқталған." }, { status: 422 });
    }
    const passwordHash = await hashPasswordInDatabase(database, parsed.data.password);
    const changed = await database.$transaction(async (transaction) => {
      const [claimed] = await transaction.$queryRaw<Array<{ userId: string; usedAt: Date }>>(Prisma.sql`
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        RETURNING user_id AS "userId", used_at AS "usedAt"
      `);
      if (!claimed) return false;
      await transaction.user.update({ where: { id: claimed.userId }, data: { passwordHash, updatedAt: claimed.usedAt } });
      await transaction.$executeRaw(Prisma.sql`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ${claimed.userId} AND used_at IS NULL`);
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: claimed.userId, actionType: "account.password_reset",
        targetEntity: "user", targetEntityId: claimed.userId,
        newValue: JSON.stringify({ passwordChanged: true }), reason: "Құпиясөз бір реттік қалпына келтіру сілтемесі арқылы өзгертілді",
        ipAddress: clientIp(request), createdAt: claimed.usedAt,
      } });
      return true;
    });
    if (!changed) return Response.json({ error: "invalid_token", message: "Қалпына келтіру сілтемесі қолданылып қойған." }, { status: 422 });
    return Response.json({ reset: true, url: "/login?reset=success" });
  } catch {
    return Response.json({ error: "unexpected", message: "Құпиясөзді өзгерту мүмкін болмады." }, { status: 500 });
  }
}
