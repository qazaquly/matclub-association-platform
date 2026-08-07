import { headers } from "next/headers";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { readCookie, verifySessionToken } from "./security";
import type { AppUser, MembershipStatus, RoleSlug, UserRoleAssignment } from "./types";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  profileId: string;
  membershipStatus: MembershipStatus;
  branchId: string | null;
}

export async function getAppUserById(userId: string, sessionId: string): Promise<AppUser | null> {
  await ensureDatabase();
  const database = getRawDb();
  const user = await database
    .prepare(
      `SELECT u.id, u.email, p.full_name AS fullName, p.id AS profileId,
              p.membership_status AS membershipStatus, p.branch_id AS branchId
       FROM users u
       JOIN person_profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.status = 'active' AND u.archived_at IS NULL`,
    )
    .bind(userId)
    .first<UserRow>();
  if (!user) return null;

  const assignments = await database
    .prepare(
      `SELECT ur.id AS assignmentId, r.slug, r.name_kk AS nameKk,
              r.access_level AS accessLevel, ur.scope_type AS scopeType, ur.scope_id AS scopeId
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.revoked_at IS NULL
       ORDER BY r.access_level, r.name_kk`,
    )
    .bind(userId)
    .all<UserRoleAssignment>();

  return {
    ...user,
    roles: assignments.results.map((assignment) => ({
      ...assignment,
      slug: assignment.slug as RoleSlug,
    })),
    sessionId,
  };
}

export async function authenticateCookie(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, "ramk_session");
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return getAppUserById(payload.userId, payload.sessionId);
}

export async function authenticateRequest(request: Request) {
  return authenticateCookie(request.headers.get("cookie"));
}

export async function getCurrentUser() {
  const requestHeaders = await headers();
  return authenticateCookie(requestHeaders.get("cookie"));
}
