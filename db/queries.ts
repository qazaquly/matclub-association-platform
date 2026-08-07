import { ensureDatabase } from "./bootstrap";
import { getRawDb } from "./index";
import { branchScopeIds, isFullAccess } from "@/lib/authorization";
import type { AppUser } from "@/lib/types";

export interface DashboardMetrics {
  registeredUsers: number;
  applicants: number;
  awaitingReview: number;
  reserve: number;
  members: number;
  rejected: number;
}

export interface ApplicationListRow {
  id: string;
  fullName: string;
  email: string;
  cityDistrict: string;
  workplace: string | null;
  position: string | null;
  status: string;
  submittedAt: string;
  branchId: string;
  branchName: string;
}

function scopedWhere(user: AppUser, alias: string) {
  if (isFullAccess(user)) return { clause: "1 = 1", params: [] as string[] };
  const branches = branchScopeIds(user);
  if (branches.length === 0) return { clause: "1 = 0", params: [] as string[] };
  return {
    clause: `${alias}.branch_id IN (${branches.map(() => "?").join(",")})`,
    params: branches,
  };
}

export async function getDashboardMetrics(user: AppUser): Promise<DashboardMetrics> {
  await ensureDatabase();
  const database = getRawDb();
  const profileScope = scopedWhere(user, "p");
  const applicationScope = scopedWhere(user, "a");
  const [registered, applications] = await database.batch([
    database.prepare(
      `SELECT COUNT(*) AS registeredUsers,
              SUM(CASE WHEN p.membership_status = 'applicant' THEN 1 ELSE 0 END) AS applicants,
              SUM(CASE WHEN p.membership_status = 'reserve' THEN 1 ELSE 0 END) AS reserve,
              SUM(CASE WHEN p.membership_status = 'member' THEN 1 ELSE 0 END) AS members,
              SUM(CASE WHEN p.membership_status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM person_profiles p WHERE p.archived_at IS NULL AND ${profileScope.clause}`,
    ).bind(...profileScope.params),
    database.prepare(
      `SELECT SUM(CASE WHEN a.status = 'awaiting_review' THEN 1 ELSE 0 END) AS awaitingReview
       FROM membership_applications a WHERE a.archived_at IS NULL AND ${applicationScope.clause}`,
    ).bind(...applicationScope.params),
  ]);
  const profileRow = (registered.results?.[0] ?? {}) as Partial<DashboardMetrics>;
  const applicationRow = (applications.results?.[0] ?? {}) as Partial<DashboardMetrics>;
  return {
    registeredUsers: Number(profileRow.registeredUsers ?? 0),
    applicants: Number(profileRow.applicants ?? 0),
    awaitingReview: Number(applicationRow.awaitingReview ?? 0),
    reserve: Number(profileRow.reserve ?? 0),
    members: Number(profileRow.members ?? 0),
    rejected: Number(profileRow.rejected ?? 0),
  };
}

export async function listApplications(user: AppUser, limit = 50) {
  await ensureDatabase();
  const database = getRawDb();
  const scope = scopedWhere(user, "a");
  const result = await database
    .prepare(
      `SELECT a.id, p.full_name AS fullName, p.email, p.city_district AS cityDistrict,
              p.workplace, p.position, a.status, a.submitted_at AS submittedAt,
              a.branch_id AS branchId, b.name AS branchName
       FROM membership_applications a
       JOIN person_profiles p ON p.id = a.person_id
       JOIN branches b ON b.id = a.branch_id
       WHERE a.archived_at IS NULL AND ${scope.clause}
       ORDER BY CASE a.status WHEN 'awaiting_review' THEN 0 WHEN 'reserve' THEN 1 ELSE 2 END,
                a.submitted_at DESC LIMIT ?`,
    )
    .bind(...scope.params, limit)
    .all<ApplicationListRow>();
  return result.results;
}

export interface ApplicationDetail extends ApplicationListRow {
  personId: string;
  birthYear: number | null;
  phone: string;
  education: string | null;
  professionalExperience: string | null;
  mathSpecialization: string | null;
  achievements: string | null;
  biography: string | null;
  decisionReason: string | null;
  reviewedAt: string | null;
  source: string;
}

export async function getApplicationDetail(user: AppUser, id: string) {
  await ensureDatabase();
  const database = getRawDb();
  const scope = scopedWhere(user, "a");
  const application = await database
    .prepare(
      `SELECT a.id, a.person_id AS personId, p.full_name AS fullName, p.birth_year AS birthYear,
              p.email, p.phone, p.city_district AS cityDistrict, p.workplace, p.position,
              p.education, p.professional_experience AS professionalExperience,
              p.math_specialization AS mathSpecialization, p.achievements, p.biography,
              a.status, a.submitted_at AS submittedAt, a.reviewed_at AS reviewedAt,
              a.decision_reason AS decisionReason, a.source, a.branch_id AS branchId,
              b.name AS branchName
       FROM membership_applications a
       JOIN person_profiles p ON p.id = a.person_id
       JOIN branches b ON b.id = a.branch_id
       WHERE a.id = ? AND a.archived_at IS NULL AND ${scope.clause}`,
    )
    .bind(id, ...scope.params)
    .first<ApplicationDetail>();
  if (!application) return null;

  const [documents, notes, history] = await Promise.all([
    database.prepare(
      `SELECT id, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes,
              created_at AS createdAt FROM uploaded_documents
       WHERE application_id = ? AND archived_at IS NULL ORDER BY created_at`,
    ).bind(id).all<{ id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }>(),
    database.prepare(
      `SELECT n.id, n.note, n.visibility, n.created_at AS createdAt, p.full_name AS authorName
       FROM internal_notes n JOIN person_profiles p ON p.user_id = n.author_user_id
       WHERE n.application_id = ? AND n.archived_at IS NULL
         AND (n.visibility = 'branch' OR ? = 1)
       ORDER BY n.created_at DESC`,
    ).bind(id, isFullAccess(user) ? 1 : 0).all<{ id: string; note: string; visibility: string; createdAt: string; authorName: string }>(),
    database.prepare(
      `SELECT previous_status AS previousStatus, new_status AS newStatus, reason,
              visibility, created_at AS createdAt
       FROM membership_status_history WHERE application_id = ?
         AND (visibility = 'member' OR ? = 1)
       ORDER BY created_at DESC`,
    ).bind(id, isFullAccess(user) ? 1 : 0).all<{ previousStatus: string | null; newStatus: string; reason: string | null; visibility: string; createdAt: string }>(),
  ]);

  return { application, documents: documents.results, notes: notes.results, history: history.results };
}

export async function listMembers(user: AppUser, limit = 100) {
  await ensureDatabase();
  const database = getRawDb();
  const scope = scopedWhere(user, "p");
  const result = await database.prepare(
    `SELECT p.id, p.full_name AS fullName, p.email, p.phone, p.workplace, p.position,
            p.membership_status AS membershipStatus, p.membership_started_at AS membershipStartedAt,
            p.branch_id AS branchId, b.name AS branchName
     FROM person_profiles p LEFT JOIN branches b ON b.id = p.branch_id
     WHERE p.archived_at IS NULL AND ${scope.clause}
     ORDER BY p.full_name LIMIT ?`,
  ).bind(...scope.params, limit).all<{
    id: string; fullName: string; email: string; phone: string; workplace: string | null;
    position: string | null; membershipStatus: string; membershipStartedAt: string | null;
    branchId: string | null; branchName: string | null;
  }>();
  return result.results;
}

export async function getOwnProfile(user: AppUser) {
  await ensureDatabase();
  return getRawDb().prepare(
    `SELECT p.*, b.name AS branchName FROM person_profiles p
     LEFT JOIN branches b ON b.id = p.branch_id WHERE p.id = ? AND p.archived_at IS NULL`,
  ).bind(user.profileId).first<Record<string, string | number | null> & { branchName: string | null }>();
}

export async function listBranches() {
  await ensureDatabase();
  const result = await getRawDb().prepare(
    `SELECT b.id, b.name, b.region_code AS regionCode, b.region_name AS regionName, b.status,
            p.full_name AS directorName,
            SUM(CASE WHEN members.membership_status = 'member' THEN 1 ELSE 0 END) AS memberCount,
            SUM(CASE WHEN members.membership_status = 'applicant' THEN 1 ELSE 0 END) AS applicantCount,
            SUM(CASE WHEN members.membership_status = 'reserve' THEN 1 ELSE 0 END) AS reserveCount
     FROM branches b
     LEFT JOIN person_profiles p ON p.id = b.director_profile_id
     LEFT JOIN person_profiles members ON members.branch_id = b.id AND members.archived_at IS NULL
     WHERE b.archived_at IS NULL
     GROUP BY b.id ORDER BY b.region_name`,
  ).all<{
    id: string; name: string; regionCode: string; regionName: string; status: string;
    directorName: string | null; memberCount: number; applicantCount: number; reserveCount: number;
  }>();
  return result.results;
}

export async function listAuditLogs(limit = 80) {
  await ensureDatabase();
  const result = await getRawDb().prepare(
    `SELECT a.id, a.action_type AS actionType, a.target_entity AS targetEntity,
            a.target_entity_id AS targetEntityId, a.previous_value AS previousValue,
            a.new_value AS newValue, a.reason, a.ip_address AS ipAddress,
            a.session_id AS sessionId, a.created_at AS createdAt,
            p.full_name AS actorName
     FROM audit_logs a LEFT JOIN person_profiles p ON p.user_id = a.actor_user_id
     ORDER BY a.created_at DESC LIMIT ?`,
  ).bind(limit).all<{
    id: string; actionType: string; targetEntity: string; targetEntityId: string;
    previousValue: string | null; newValue: string | null; reason: string | null;
    ipAddress: string | null; sessionId: string | null; createdAt: string; actorName: string | null;
  }>();
  return result.results;
}

export async function listUsersAndRoles() {
  await ensureDatabase();
  const database = getRawDb();
  const [users, assignments, rolesList] = await Promise.all([
    database.prepare(
      `SELECT u.id, u.email, p.full_name AS fullName, p.membership_status AS membershipStatus,
              p.branch_id AS branchId, b.name AS branchName
       FROM users u JOIN person_profiles p ON p.user_id = u.id
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE u.archived_at IS NULL ORDER BY p.full_name`,
    ).all<{ id: string; email: string; fullName: string; membershipStatus: string; branchId: string | null; branchName: string | null }>(),
    database.prepare(
      `SELECT ur.id, ur.user_id AS userId, r.slug, r.name_kk AS nameKk, ur.scope_type AS scopeType,
              ur.scope_id AS scopeId FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.revoked_at IS NULL ORDER BY r.name_kk`,
    ).all<{ id: string; userId: string; slug: string; nameKk: string; scopeType: string; scopeId: string | null }>(),
    database.prepare("SELECT id, slug, name_kk AS nameKk, access_level AS accessLevel FROM roles ORDER BY access_level, name_kk")
      .all<{ id: string; slug: string; nameKk: string; accessLevel: string }>(),
  ]);
  return { users: users.results, assignments: assignments.results, roles: rolesList.results };
}

export async function recordAudit(input: {
  actorUserId?: string | null;
  actionType: string;
  targetEntity: string;
  targetEntityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  sessionId?: string | null;
}) {
  await ensureDatabase();
  await getRawDb().prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id,
      previous_value, new_value, reason, ip_address, session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), input.actorUserId ?? null, input.actionType, input.targetEntity,
    input.targetEntityId, input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
    input.newValue === undefined ? null : JSON.stringify(input.newValue), input.reason ?? null,
    input.ipAddress ?? null, input.sessionId ?? null, new Date().toISOString(),
  ).run();
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  await ensureDatabase();
  const database = getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const row = await database.prepare("SELECT window_start AS windowStart, count FROM rate_limits WHERE key = ?").bind(key).first<{ windowStart: number; count: number }>();
  if (!row || now - row.windowStart >= windowSeconds) {
    await database.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1").bind(key, now).run();
    return true;
  }
  if (row.count >= limit) return false;
  await database.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
