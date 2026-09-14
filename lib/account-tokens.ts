import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { getTransactionalEmailProvider, type EmailDeliveryResult } from "@/lib/email/transactional-email";
import { runtimeEnv } from "@/lib/runtime-env";
import { sha256Hex } from "@/lib/security";

const encoder = new TextEncoder();
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function tokenHash(token: string) {
  return sha256Hex(encoder.encode(token).buffer);
}

function publicBaseUrl(requestUrl: string) {
  const configured = runtimeEnv("APP_BASE_URL")?.trim();
  return (configured ? new URL(configured) : new URL(requestUrl)).origin;
}

function verificationMessage(link: string) {
  return {
    subject: "Электрондық поштаңызды растаңыз",
    text: `Республикалық математиктер бірлестігі платформасындағы электрондық поштаңызды растау үшін сілтемені ашыңыз: ${link}\n\nСілтеме 24 сағат жарамды.`,
    html: `<p>Республикалық математиктер бірлестігі платформасындағы электрондық поштаңызды растаңыз.</p><p><a href="${link}">Электрондық поштаны растау</a></p><p>Сілтеме 24 сағат жарамды.</p>`,
  };
}

function resetMessage(link: string) {
  return {
    subject: "Құпиясөзді қалпына келтіру",
    text: `Құпиясөзді жаңарту үшін сілтемені ашыңыз: ${link}\n\nСілтеме 1 сағат жарамды. Егер бұл сұрауды сіз жібермесеңіз, хатты елемеңіз.`,
    html: `<p>Құпиясөзді жаңарту сұрауы қабылданды.</p><p><a href="${link}">Жаңа құпиясөз орнату</a></p><p>Сілтеме 1 сағат жарамды. Егер бұл сұрауды сіз жібермесеңіз, хатты елемеңіз.</p>`,
  };
}

export async function issueEmailVerification(userId: string, email: string, requestUrl: string): Promise<EmailDeliveryResult> {
  const database = getDb();
  const rawToken = randomToken();
  const hash = await tokenHash(rawToken);
  const id = crypto.randomUUID();
  const [clock] = await database.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT CURRENT_TIMESTAMP AS now`);
  const now = clock?.now ?? new Date();
  await database.$transaction([
    database.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    database.emailVerificationToken.create({ data: { id, userId, tokenHash: hash, expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS), createdAt: now } }),
  ]);
  const link = `${publicBaseUrl(requestUrl)}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const message = verificationMessage(link);
  return getTransactionalEmailProvider().send({ to: email, ...message, idempotencyKey: `verify-${id}` });
}

export async function issuePasswordReset(userId: string, email: string, requestUrl: string): Promise<EmailDeliveryResult> {
  const database = getDb();
  const rawToken = randomToken();
  const hash = await tokenHash(rawToken);
  const id = crypto.randomUUID();
  const [clock] = await database.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT CURRENT_TIMESTAMP AS now`);
  const now = clock?.now ?? new Date();
  await database.$transaction([
    database.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    database.passwordResetToken.create({ data: { id, userId, tokenHash: hash, expiresAt: new Date(now.getTime() + RESET_TTL_MS), createdAt: now } }),
  ]);
  const link = `${publicBaseUrl(requestUrl)}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const message = resetMessage(link);
  return getTransactionalEmailProvider().send({ to: email, ...message, idempotencyKey: `reset-${id}` });
}
