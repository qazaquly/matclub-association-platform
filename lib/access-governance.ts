import { Prisma } from "@/generated/prisma/client";

export const protectedGlobalRoleSlugs = ["president", "vice_president_2"] as const;

export async function lockAccessGovernance(database: Prisma.TransactionClient) {
  await database.$queryRaw(Prisma.sql`
    SELECT 1::int AS acquired
    FROM (SELECT pg_advisory_xact_lock(2026081401)) AS governance_lock
  `);
}

export async function getUserAccessSnapshot(database: Prisma.TransactionClient, userId: string) {
  const assignments = await database.userRole.findMany({
    where: { userId, revokedAt: null },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
    orderBy: [{ role: { accessLevel: "asc" } }, { role: { slug: "asc" } }, { grantedAt: "asc" }],
  });

  const capabilities = [...new Set(assignments.flatMap((assignment) =>
    assignment.role.permissions.map((entry) => entry.permission.slug),
  ))].sort();

  return {
    userId,
    roles: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      role: assignment.role.slug,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      capabilities: assignment.role.permissions.map((entry) => entry.permission.slug).sort(),
    })),
    capabilities,
  };
}

export async function getPersonDepartmentAccessSnapshot(database: Prisma.TransactionClient, personId: string) {
  const person = await database.personProfile.findFirst({
    where: { id: personId, archivedAt: null },
    select: {
      id: true,
      userId: true,
      departmentAssignments: {
        where: { endedAt: null },
        select: { id: true, departmentId: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  if (!person) return null;
  return {
    userId: person.userId,
    personId: person.id,
    departmentAccess: person.departmentAssignments.map((assignment) => ({
      assignmentId: assignment.id,
      departmentId: assignment.departmentId,
    })),
  };
}

export function isProtectedGlobalRole(slug: string) {
  return (protectedGlobalRoleSlugs as readonly string[]).includes(slug);
}
