import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import {
  canManageGlobalProjects,
  projectBranchScopeIds,
  projectDepartmentScopeIds,
} from "@/lib/authorization";
import type { AppUser } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const projectInclude = {
  branch: { select: { id: true, regionName: true } },
  responsibleDepartment: { select: { id: true, nameKk: true } },
  leaderProfile: { select: { id: true, fullName: true, branchId: true } },
  publicProject: { select: { id: true, title: true, slug: true, status: true } },
  stages: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  participants: {
    include: { person: { select: { id: true, fullName: true, email: true, workplace: true, position: true, branch: { select: { regionName: true } } } }, activity: true },
    orderBy: [{ status: "asc" as const }, { joinedAt: "asc" as const }],
  },
  documents: { where: { status: "active" }, orderBy: { createdAt: "desc" as const } },
  result: true,
} satisfies Prisma.ProjectInclude;

export function managedProjectWhere(actor: AppUser) {
  if (canManageGlobalProjects(actor)) return {};
  const branches = projectBranchScopeIds(actor);
  const departments = projectDepartmentScopeIds(actor);
  return {
    OR: [
      ...(branches.length ? [{ branchId: { in: branches } }] : []),
      ...(branches.length ? [{ projectScope: "ALL_BRANCHES" }] : []),
      ...(departments.length ? [{ responsibleDepartmentId: { in: departments } }] : []),
      { leaderProfileId: actor.profileId },
    ],
  };
}

export async function listManagedProjects(actor: AppUser) {
  await ensureDatabase();
  return getDb().project.findMany({
    where: managedProjectWhere(actor),
    include: {
      branch: { select: { id: true, regionName: true } },
      responsibleDepartment: { select: { id: true, nameKk: true } },
      leaderProfile: { select: { id: true, fullName: true } },
      publicProject: { select: { slug: true, status: true } },
      _count: { select: { participants: true, stages: true, documents: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getManagedProject(id: string) {
  await ensureDatabase();
  return getDb().project.findUnique({ where: { id }, include: projectInclude });
}

export async function getProjectFormOptions(actor: AppUser) {
  await ensureDatabase();
  const database = getDb();
  const global = canManageGlobalProjects(actor);
  const branchIds = projectBranchScopeIds(actor);
  const departmentIds = projectDepartmentScopeIds(actor);
  const peopleWhere = global ? { archivedAt: null, membershipStatus: "member" } : branchIds.length ? {
    archivedAt: null, membershipStatus: "member", branchId: { in: branchIds },
  } : {
    archivedAt: null, membershipStatus: "member",
    departmentAssignments: { some: { endedAt: null, departmentId: { in: departmentIds } } },
  };
  const [branches, departments, people, publicProjects] = await Promise.all([
    database.branch.findMany({ where: { archivedAt: null, status: "active", ...(global ? {} : { id: { in: branchIds } }) }, select: { id: true, regionName: true }, orderBy: { regionName: "asc" } }),
    database.department.findMany({ where: { archivedAt: null, ...(global ? {} : { id: { in: departmentIds } }) }, select: { id: true, nameKk: true }, orderBy: { nameKk: "asc" } }),
    database.personProfile.findMany({ where: peopleWhere, select: { id: true, fullName: true, branchId: true }, orderBy: { fullName: "asc" }, take: 2_000 }),
    global ? database.publicProject.findMany({ where: { archivedAt: null }, select: { id: true, title: true, status: true }, orderBy: { title: "asc" } }) : [],
  ]);
  return { branches, departments, people, publicProjects };
}

export async function listEligibleProjectMembers(actor: AppUser, project: { projectScope: string; branchId: string | null; responsibleDepartmentId: string | null }) {
  await ensureDatabase();
  const global = canManageGlobalProjects(actor);
  return getDb().personProfile.findMany({
    where: {
      archivedAt: null,
      membershipStatus: "member",
      ...(global ? {} : project.projectScope === "ALL_BRANCHES" ? { branchId: { in: projectBranchScopeIds(actor) } } : project.branchId ? { branchId: project.branchId } : project.responsibleDepartmentId ? {
        departmentAssignments: { some: { endedAt: null, departmentId: project.responsibleDepartmentId } },
      } : { id: actor.profileId }),
    },
    select: { id: true, fullName: true, email: true, branch: { select: { regionName: true } } },
    orderBy: { fullName: "asc" },
    take: 2_000,
  });
}
