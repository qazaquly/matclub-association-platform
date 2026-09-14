import { headers } from "next/headers";
import { cache } from "react";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { readCookie, verifySessionToken } from "./security";
import type { AppUser, MembershipStatus, RoleSlug } from "./types";

export async function getAppUserById(userId: string, sessionId: string): Promise<AppUser | null> {
  await ensureDatabase();
  const user = await getDb().user.findFirst({
    where: { id: userId, status: "active", archivedAt: null },
    include: {
      profile: true,
      roleAssignments: {
        where: { revokedAt: null },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
        orderBy: [{ role: { accessLevel: "asc" } }, { role: { nameKk: "asc" } }],
      },
    },
  });
  if (!user?.profile) return null;

  return {
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
}

export async function authenticateCookie(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, "phase1_session");
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return getAppUserById(payload.userId, payload.sessionId);
}

export async function authenticateRequest(request: Request) {
  return authenticateCookie(request.headers.get("cookie"));
}

export const getCurrentUser = cache(async () => {
  const requestHeaders = await headers();
  return authenticateCookie(requestHeaders.get("cookie"));
});
