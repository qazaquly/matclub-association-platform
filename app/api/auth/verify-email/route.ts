import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { tokenHash } from "@/lib/account-tokens";

export async function GET(request: Request) {
  await ensureDatabase();
  const rawToken = new URL(request.url).searchParams.get("token") ?? "";
  if (rawToken.length < 20) return Response.redirect(new URL("/verify-email?state=invalid", request.url), 303);
  const hash = await tokenHash(rawToken);
  const database = getDb();
  const verified = await database.$transaction(async (transaction) => {
    const [claimed] = await transaction.$queryRaw<Array<{ userId: string; usedAt: Date }>>(Prisma.sql`
      UPDATE email_verification_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      RETURNING user_id AS "userId", used_at AS "usedAt"
    `);
    if (!claimed) return false;
    await transaction.user.update({ where: { id: claimed.userId }, data: { emailVerifiedAt: claimed.usedAt, updatedAt: claimed.usedAt } });
    await transaction.auditLog.create({ data: {
      id: crypto.randomUUID(), actorUserId: claimed.userId, actionType: "account.email_verified",
      targetEntity: "user", targetEntityId: claimed.userId,
      newValue: JSON.stringify({ emailVerified: true }), reason: "Электрондық пошта бір реттік сілтеме арқылы расталды", createdAt: claimed.usedAt,
    } });
    return true;
  });
  return Response.redirect(new URL(verified ? "/verify-email?state=verified" : "/verify-email?state=invalid", request.url), 303);
}
