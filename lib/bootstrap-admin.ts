import type { DatabaseClient } from "@/db";
import { hashPassword } from "@/lib/security";

export type BootstrapAdminRole = "president" | "vice_president_2";

export interface BootstrapAdminInput {
  role: BootstrapAdminRole;
  email: string;
  password: string;
  fullName: string;
  regionCode: string;
  cityDistrict: string;
  phone: string;
}

function required(value: string, name: string, minimum = 2) {
  const normalized = value.trim();
  if (normalized.length < minimum) throw new Error(`INVALID_${name}`);
  return normalized;
}

export async function bootstrapPrivilegedAccount(database: DatabaseClient, input: BootstrapAdminInput) {
  if (!new Set<BootstrapAdminRole>(["president", "vice_president_2"]).has(input.role)) throw new Error("INVALID_BOOTSTRAP_ROLE");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".example.test")) throw new Error("INVALID_BOOTSTRAP_EMAIL");
  if (input.password.length < 14 || input.password.length > 128) throw new Error("INVALID_BOOTSTRAP_PASSWORD");
  const fullName = required(input.fullName, "FULL_NAME", 5);
  const regionCode = required(input.regionCode, "REGION_CODE");
  const cityDistrict = required(input.cityDistrict, "CITY_DISTRICT");
  const phone = required(input.phone, "PHONE", 7);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  return database.$transaction(async (tx) => {
    const duplicate = await tx.user.findFirst({ where: { email }, select: { id: true } })
      ?? await tx.personProfile.findFirst({ where: { email }, select: { id: true } });
    if (duplicate) throw new Error("BOOTSTRAP_EMAIL_ALREADY_EXISTS");
    const role = await tx.role.findUnique({ where: { slug: input.role }, select: { id: true, slug: true } });
    if (!role) throw new Error("BOOTSTRAP_ROLE_NOT_MIGRATED");

    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    await tx.user.create({ data: { id: userId, email, passwordHash, emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now } });
    await tx.personProfile.create({ data: {
      id: profileId,
      userId,
      fullName,
      regionCode,
      cityDistrict,
      phone,
      email,
      membershipStatus: "registered_user",
      createdAt: now,
      updatedAt: now,
    } });
    await tx.userRole.create({ data: {
      id: assignmentId,
      userId,
      roleId: role.id,
      scopeType: "global",
      scopeId: null,
      grantedAt: now,
    } });
    await tx.auditLog.create({ data: {
      id: crypto.randomUUID(),
      actorUserId: null,
      actionType: "production_bootstrap.admin_created",
      targetEntity: "user",
      targetEntityId: userId,
      newValue: JSON.stringify({ email, role: role.slug, profileId, membershipStatus: "registered_user" }),
      reason: "Explicit one-time production bootstrap command",
      createdAt: now,
    } });
    return { userId, profileId, role: role.slug };
  });
}
