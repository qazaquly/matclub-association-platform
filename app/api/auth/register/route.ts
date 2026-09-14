import { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { hashPasswordInDatabase } from "@/db/password";
import { checkRateLimit } from "@/db/queries";
import { issueEmailVerification } from "@/lib/account-tokens";
import { registrationSchema, validationErrors } from "@/lib/account-validation";
import { assertSameOrigin, clientIp, createSessionToken, sessionCookie } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureDatabase();
    const input = await request.json() as Record<string, unknown>;
    const parsed = registrationSchema.safeParse(input);
    if (!parsed.success) return Response.json({ errors: validationErrors(parsed.error) }, { status: 422 });

    const database = getDb();
    const ipAddress = clientIp(request);
    if (!(await checkRateLimit(`account:register:ip:${ipAddress}`, 5, 3600))) {
      return Response.json({ error: "rate_limited", message: "Тіркелу әрекеті тым жиі қайталанды. Кейінірек қайталап көріңіз." }, { status: 429 });
    }
    if (await database.user.findFirst({ where: { email: parsed.data.email, archivedAt: null }, select: { id: true } })) {
      return Response.json({ errors: { email: "Бұл электрондық пошта тіркелген. Жүйеге кіріңіз." } }, { status: 409 });
    }

    const now = new Date();
    const userId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const passwordHash = await hashPasswordInDatabase(database, parsed.data.password);
    try {
      await database.$transaction(async (transaction) => {
        await transaction.user.create({ data: {
          id: userId, email: parsed.data.email, passwordHash, emailVerifiedAt: null,
          status: "active", createdAt: now, updatedAt: now,
        } });
        await transaction.personProfile.create({ data: {
          id: personId, userId, fullName: parsed.data.email, regionCode: "", cityDistrict: "", phone: "",
          email: parsed.data.email, membershipStatus: "registered_user", createdAt: now, updatedAt: now,
        } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: userId, actionType: "account.registered",
          targetEntity: "user", targetEntityId: userId,
          newValue: JSON.stringify({ profileId: personId, email: parsed.data.email, emailVerified: false }),
          reason: "Мүшелік өтінішінен бөлек тұрақты тіркелгі жасалды", ipAddress, createdAt: now,
        } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return Response.json({ errors: { email: "Бұл электрондық пошта тіркелген. Жүйеге кіріңіз." } }, { status: 409 });
      }
      throw error;
    }

    let delivery: "sent" | "unconfigured" | "failed" = "failed";
    try {
      const result = await issueEmailVerification(userId, parsed.data.email, request.url);
      delivery = result.delivered ? "sent" : "unconfigured";
    } catch {
      delivery = "failed";
    }
    const token = await createSessionToken(userId);
    return Response.json({ registered: true, delivery, url: `/verify-email?state=${delivery}` }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:") },
    });
  } catch {
    return Response.json({ error: "unexpected", message: "Тіркелгіні жасау мүмкін болмады. Қайталап көріңіз." }, { status: 500 });
  }
}

