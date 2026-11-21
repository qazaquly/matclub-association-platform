import { headers } from "next/headers";
import { cache } from "react";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { readCookie, sessionCredentialTag, upgradeSessionCookie, verifySessionToken } from "./security";
import type { SessionPayload } from "./security";
import type { AppUser, MembershipStatus, RoleSlug } from "./types";

async function getSessionUser({ userId, sessionId, issuedAt, credentialTag }: SessionPayload) {
  await ensureDatabase();
  const database = getDb();
  const user = await database.user.findFirst({
    where: {
      id: userId, status: "active", archivedAt: null,
      auditLogs: { none: { targetEntity: "user", targetEntityId: userId, actionType: "auth.logout", sessionId } },
    },
    include: {
      profile: true,
      roleAssignments: {
        where: { revokedAt: null },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
        orderBy: [{ role: { accessLevel: "asc" } }, { role: { nameKk: "asc" } }],
      },
    },
  });
  if (!user?.profile || !user.passwordHash) return null;
  if (credentialTag && credentialTag !== await sessionCredentialTag(user.passwordHash)) return null;
  if (!credentialTag) {
    const passwordChange = await database.auditLog.findFirst({
      where: {
        targetEntity: "user", targetEntityId: userId,
        actionType: { in: ["account.password_reset", "production_bootstrap.password_set"] },
        createdAt: { gte: new Date(issuedAt * 1000) },
      },
      select: { id: true },
    });
    if (passwordChange) return null;
  }

  const appUser: AppUser = {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    fullName: user.profile.fullName,
    profileId: user.profile.id,
    membershipStatus: user.profile.membershipStatus as MembershipStatus,
    branchId: user.profile.branchId,
    roles: user.roleAssignments.map((assignment) => ({
      assignmentId: assignment.id,
      slug: assignment.role.slug as RoleSlug,
      nameKk: assignment.role.nameKk,
      accessLevel: assignment.role.accessLevel as "A" | "B" | "C" | "D",
      scopeType: assignment.scopeType as "global" | "branch" | "department",
      scopeId: assignment.scopeId,
    })),
    permissions: [...new Set(user.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((entry) => entry.permission.slug)))],
    sessionId,
  };
  return { appUser, passwordHash: user.passwordHash };
}

export async function authenticateCookie(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, "phase1_session");
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return (await getSessionUser(payload))?.appUser ?? null;
}

export async function renewPreviousSession(request: Request) {
  const token = readCookie(request.headers.get("cookie"), "phase1_session");
  if (!token || token.startsWith("v2.")) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await getSessionUser(payload);
  if (!user) return null;
  return upgradeSessionCookie(payload, user.passwordHash, new URL(request.url).protocol === "https:");
}

export async function authenticateRequest(request: Request) {
  return authenticateCookie(request.headers.get("cookie"));
}

export const getCurrentUser = cache(async () => {
  const requestHeaders = await headers();
  return authenticateCookie(requestHeaders.get("cookie"));
});
