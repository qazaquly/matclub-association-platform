import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { hashPassword, verifyPassword } from "../lib/security";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("MISSING_VERIFICATION_INPUT");
  return value;
}

if (process.env.ENVIRONMENT !== "production") throw new Error("PRODUCTION_ENVIRONMENT_REQUIRED");

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("PRODUCTION_DATABASE_REQUIRED");

const baseUrl = new URL(requiredEnvironment("PRODUCTION_BASE_URL"));
const presidentEmail = requiredEnvironment("VERIFY_PRESIDENT_EMAIL").toLowerCase();
const presidentPassword = requiredEnvironment("VERIFY_PRESIDENT_PASSWORD");
const vicePresidentEmail = requiredEnvironment("VERIFY_VP2_EMAIL").toLowerCase();
const vicePresidentPassword = requiredEnvironment("VERIFY_VP2_PASSWORD");
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type Session = { cookie: string; email: string };

function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function login(account: "PRESIDENT" | "VP2" | "LOWER", email: string, password: string): Promise<Session> {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: baseUrl.origin,
    },
    body: new URLSearchParams({ email, password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  requireCondition(response.status === 303, `${account}_LOGIN_STATUS_FAILED`);
  const location = response.headers.get("location") ?? "";
  if (location.includes("error=credentials")) throw new Error(`${account}_LOGIN_CREDENTIALS_REJECTED`);
  if (location.includes("error=unexpected")) throw new Error(`${account}_LOGIN_RUNTIME_FAILED`);
  if (!cookie?.startsWith("phase1_session=")) throw new Error(`${account}_LOGIN_COOKIE_MISSING`);
  return { cookie, email };
}

async function authenticatedGet(session: Session, path: string) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    headers: { cookie: session.cookie },
  });
  requireCondition(response.status === 200, "PROTECTED_AREA_FAILED");
}

async function roleRequest(session: Session, values: Record<string, string>) {
  return fetch(new URL("/api/access/roles", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: session.cookie,
      origin: baseUrl.origin,
    },
    body: new URLSearchParams(values),
  });
}

const verificationStartedAt = new Date();
const verificationId = crypto.randomUUID();
const testUserId = `production-governance-test-${verificationId}`;
const testProfileId = `production-governance-profile-${verificationId}`;
const testEmail = `production-governance-${verificationId}@example.test`;
const testPassword = `T-${crypto.randomUUID()}-9a!`;
let testUserCreated = false;

const result = {
  bothAccountsCreated: false,
  bothProductionLoginsPassed: false,
  bothHaveFullGlobalAccess: false,
  roleManagementRestrictedToPresidentAndVp2: false,
  auditLoggingPassed: false,
  failureStage: null as string | null,
};

try {
  const [president, vicePresident, presidentRole, vicePresidentRole, memberRole] = await Promise.all([
    database.user.findFirst({
      where: { email: presidentEmail, status: "active", archivedAt: null },
      include: { profile: true, roleAssignments: { where: { revokedAt: null }, include: { role: true } } },
    }),
    database.user.findFirst({
      where: { email: vicePresidentEmail, status: "active", archivedAt: null },
      include: { profile: true, roleAssignments: { where: { revokedAt: null }, include: { role: true } } },
    }),
    database.role.findUnique({
      where: { slug: "president" },
      include: { permissions: { include: { permission: true } } },
    }),
    database.role.findUnique({
      where: { slug: "vice_president_2" },
      include: { permissions: { include: { permission: true } } },
    }),
    database.role.findUnique({ where: { slug: "member" } }),
  ]);

  requireCondition(president?.profile && vicePresident?.profile && presidentRole && vicePresidentRole && memberRole, "ACCOUNT_OR_ROLE_MISSING");
  requireCondition(president.profile.membershipStatus === "registered_user", "PRESIDENT_MEMBERSHIP_ROLE_COUPLED");
  requireCondition(vicePresident.profile.membershipStatus === "registered_user", "VP2_MEMBERSHIP_ROLE_COUPLED");
  requireCondition(president.roleAssignments.some((entry) => entry.role.slug === "president" && entry.scopeType === "global"), "PRESIDENT_SCOPE_INVALID");
  requireCondition(vicePresident.roleAssignments.some((entry) => entry.role.slug === "vice_president_2" && entry.scopeType === "global"), "VP2_SCOPE_INVALID");
  const presidentPasswordHash = president.passwordHash;
  const vicePresidentPasswordHash = vicePresident.passwordHash;
  if (!presidentPasswordHash?.startsWith("pbkdf2_sha256$") || presidentPasswordHash === presidentPassword) {
    throw new Error("PRESIDENT_PASSWORD_STORAGE_INVALID");
  }
  if (!vicePresidentPasswordHash?.startsWith("pbkdf2_sha256$") || vicePresidentPasswordHash === vicePresidentPassword) {
    throw new Error("VP2_PASSWORD_STORAGE_INVALID");
  }
  requireCondition(await verifyPassword(presidentPassword, presidentPasswordHash), "PRESIDENT_LOCAL_PASSWORD_HASH_FAILED");
  requireCondition(await verifyPassword(vicePresidentPassword, vicePresidentPasswordHash), "VP2_LOCAL_PASSWORD_HASH_FAILED");
  result.bothAccountsCreated = true;

  const presidentPermissions = presidentRole.permissions.map((entry) => entry.permission.slug).sort();
  const vicePresidentPermissions = vicePresidentRole.permissions.map((entry) => entry.permission.slug).sort();
  requireCondition(JSON.stringify(presidentPermissions) === JSON.stringify(vicePresidentPermissions), "GLOBAL_CAPABILITIES_DIFFER");
  requireCondition(presidentPermissions.includes("all.read") && presidentPermissions.includes("all.write"), "GLOBAL_CAPABILITIES_INCOMPLETE");
  requireCondition(presidentPermissions.includes("roles.manage") && presidentPermissions.includes("public_content.manage"), "GOVERNANCE_CAPABILITIES_INCOMPLETE");
  result.bothHaveFullGlobalAccess = true;

  await database.$transaction(async (transaction) => {
    await transaction.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        passwordHash: await hashPassword(testPassword),
        status: "active",
      },
    });
    await transaction.personProfile.create({
      data: {
        id: testProfileId,
        userId: testUserId,
        fullName: "Production governance verification user",
        regionCode: "AST",
        cityDistrict: "Астана",
        phone: "+7 000 000 0000",
        email: testEmail,
        membershipStatus: "registered_user",
      },
    });
  });
  testUserCreated = true;

  const [presidentSession, vicePresidentSession, lowerSession] = await Promise.all([
    login("PRESIDENT", presidentEmail, presidentPassword),
    login("VP2", vicePresidentEmail, vicePresidentPassword),
    login("LOWER", testEmail, testPassword),
  ]);
  result.bothProductionLoginsPassed = true;

  const globalAreas = [
    "/dashboard",
    "/dashboard/members",
    "/dashboard/branches",
    "/dashboard/applications",
    "/dashboard/audit",
    "/dashboard/access",
    "/dashboard/content",
  ];
  await Promise.all(globalAreas.flatMap((path) => [
    authenticatedGet(presidentSession, path),
    authenticatedGet(vicePresidentSession, path),
  ]));

  const forbiddenElevation = await roleRequest(lowerSession, {
    action: "grant",
    userId: testUserId,
    roleId: presidentRole.id,
    reason: `Forbidden self-elevation verification ${verificationId}`,
  });
  requireCondition(forbiddenElevation.status === 403, "LOWER_ROLE_COULD_ELEVATE");

  const grantReason = `President production role grant verification ${verificationId}`;
  const grantResponse = await roleRequest(presidentSession, {
    action: "grant",
    userId: testUserId,
    roleId: memberRole.id,
    reason: grantReason,
  });
  requireCondition(grantResponse.status === 303, "PRESIDENT_GRANT_FAILED");
  const assignment = await database.userRole.findFirst({
    where: { userId: testUserId, roleId: memberRole.id, revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  requireCondition(assignment?.grantedBy === president.id, "PRESIDENT_GRANT_NOT_PERSISTED");

  const grantAudit = await database.auditLog.findFirst({
    where: {
      actorUserId: president.id,
      targetEntity: "user_access",
      targetEntityId: testUserId,
      actionType: "role.granted",
      reason: grantReason,
      createdAt: { gte: verificationStartedAt },
    },
    orderBy: { createdAt: "desc" },
  });
  requireCondition(grantAudit?.previousValue && grantAudit.newValue && grantAudit.createdAt, "GRANT_AUDIT_INCOMPLETE");
  const grantBefore = JSON.parse(grantAudit.previousValue) as { roles?: unknown[]; capabilities?: unknown[] };
  const grantAfter = JSON.parse(grantAudit.newValue) as { roles?: Array<{ role?: string }>; capabilities?: unknown[] };
  requireCondition(Array.isArray(grantBefore.roles) && Array.isArray(grantBefore.capabilities), "GRANT_AUDIT_BEFORE_INVALID");
  requireCondition(grantAfter.roles?.some((entry) => entry.role === "member") && Array.isArray(grantAfter.capabilities), "GRANT_AUDIT_AFTER_INVALID");

  const revokeReason = `VP2 production role revoke verification ${verificationId}`;
  const revokeResponse = await roleRequest(vicePresidentSession, {
    action: "revoke",
    assignmentId: assignment.id,
    reason: revokeReason,
  });
  requireCondition(revokeResponse.status === 303, "VP2_REVOKE_FAILED");
  const revokedAssignment = await database.userRole.findUnique({ where: { id: assignment.id } });
  requireCondition(revokedAssignment?.revokedAt, "VP2_REVOKE_NOT_PERSISTED");

  const revokeAudit = await database.auditLog.findFirst({
    where: {
      actorUserId: vicePresident.id,
      targetEntity: "user_access",
      targetEntityId: testUserId,
      actionType: "role.revoked",
      reason: revokeReason,
      createdAt: { gte: verificationStartedAt },
    },
    orderBy: { createdAt: "desc" },
  });
  requireCondition(revokeAudit?.previousValue && revokeAudit.newValue && revokeAudit.createdAt, "REVOKE_AUDIT_INCOMPLETE");
  const revokeBefore = JSON.parse(revokeAudit.previousValue) as { roles?: Array<{ role?: string }>; capabilities?: unknown[] };
  const revokeAfter = JSON.parse(revokeAudit.newValue) as { roles?: unknown[]; capabilities?: unknown[] };
  requireCondition(revokeBefore.roles?.some((entry) => entry.role === "member") && Array.isArray(revokeBefore.capabilities), "REVOKE_AUDIT_BEFORE_INVALID");
  requireCondition(Array.isArray(revokeAfter.roles) && Array.isArray(revokeAfter.capabilities), "REVOKE_AUDIT_AFTER_INVALID");

  const selfRevokeResponse = await roleRequest(presidentSession, {
    action: "revoke",
    assignmentId: president.roleAssignments.find((entry) => entry.role.slug === "president")!.id,
    reason: `Protected administrator verification ${verificationId}`,
  });
  requireCondition(selfRevokeResponse.status === 303 && selfRevokeResponse.headers.get("location")?.includes("error=self"), "PROTECTED_ADMIN_REVOKE_ALLOWED");
  requireCondition(await database.userRole.findFirst({ where: { userId: president.id, roleId: presidentRole.id, revokedAt: null } }), "PROTECTED_ADMIN_ROLE_LOST");

  let updateRejected = false;
  let deleteRejected = false;
  try {
    await database.$executeRawUnsafe("UPDATE audit_logs SET reason = reason WHERE id = $1", grantAudit.id);
  } catch {
    updateRejected = true;
  }
  try {
    await database.$executeRawUnsafe("DELETE FROM audit_logs WHERE id = $1", grantAudit.id);
  } catch {
    deleteRejected = true;
  }
  const immutableTriggers = await database.$queryRawUnsafe<Array<{ name: string; definition: string }>>(
    `SELECT tgname AS name, pg_get_triggerdef(oid) AS definition
     FROM pg_trigger
     WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal`,
  );
  requireCondition(updateRejected && deleteRejected, "AUDIT_MUTATION_NOT_REJECTED");
  requireCondition(immutableTriggers.some((trigger) => trigger.definition.includes("UPDATE OR DELETE")), "AUDIT_ROW_TRIGGER_MISSING");
  requireCondition(immutableTriggers.some((trigger) => trigger.definition.includes("TRUNCATE")), "AUDIT_TRUNCATE_TRIGGER_MISSING");
  requireCondition(await database.auditLog.findUnique({ where: { id: grantAudit.id } }), "AUDIT_ROW_LOST");

  result.roleManagementRestrictedToPresidentAndVp2 = true;
  result.auditLoggingPassed = true;
  console.log(JSON.stringify(result));
} catch (error) {
  result.failureStage = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "UNEXPECTED_FAILURE";
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  if (testUserCreated) {
    const now = new Date();
    await database.$transaction(async (transaction) => {
      await transaction.userRole.updateMany({ where: { userId: testUserId, revokedAt: null }, data: { revokedAt: now } });
      await transaction.personProfile.update({ where: { id: testProfileId }, data: { archivedAt: now } });
      await transaction.user.update({ where: { id: testUserId }, data: { status: "archived", archivedAt: now } });
      await transaction.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          actionType: "production_verification.test_user_archived",
          targetEntity: "user",
          targetEntityId: testUserId,
          reason: `Production governance verification cleanup ${verificationId}`,
          createdAt: now,
        },
      });
    });
  }
  await database.$disconnect();
}
