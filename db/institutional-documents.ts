import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  branchScopeIds,
  canManageBranchInstitutionalDocuments,
  canManageDepartmentInstitutionalDocuments,
  canManageGlobalInstitutionalDocuments,
  canReadInstitutionalDocuments,
  institutionalDocumentDepartmentScopeIds,
} from "@/lib/authorization";
import type { AppUser } from "@/lib/types";

export interface InstitutionalDocumentFilters {
  q?: string;
  documentType?: string;
  status?: string;
  accessLevel?: string;
  branchId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
}

function dateFilter(raw: string | undefined, end = false) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const value = new Date(`${raw}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

export function institutionalDocumentAccessWhere(actor: AppUser): Prisma.InstitutionalDocumentWhereInput {
  if (canManageGlobalInstitutionalDocuments(actor)) return {};
  if (!canReadInstitutionalDocuments(actor)) return { id: "__forbidden__" };
  const readableBranches = branchScopeIds(actor);
  const readableDepartments = institutionalDocumentDepartmentScopeIds(actor);
  const managedBranches = canManageBranchInstitutionalDocuments(actor) ? readableBranches : [];
  const managedDepartments = canManageDepartmentInstitutionalDocuments(actor) ? readableDepartments : [];
  return {
    OR: [
      { accessLevel: "MEMBERS", status: "ACTIVE", OR: [{ scopeType: "NATIONAL" }, { scopeType: "BRANCH", branchId: actor.branchId ?? "__none__" }] },
      ...(readableBranches.length ? [{ accessLevel: "RESPONSIBLE", branchId: { in: readableBranches } }] : []),
      ...(readableDepartments.length ? [{ accessLevel: "RESPONSIBLE", responsibleDepartmentId: { in: readableDepartments } }] : []),
      ...(managedBranches.length ? [{ branchId: { in: managedBranches }, accessLevel: { not: "LEADERSHIP" } }] : []),
      ...(managedDepartments.length ? [{ scopeType: "NATIONAL", responsibleDepartmentId: { in: managedDepartments }, accessLevel: { not: "LEADERSHIP" } }] : []),
    ],
  };
}

export async function listInstitutionalDocuments(actor: AppUser, filters: InstitutionalDocumentFilters = {}) {
  await ensureDatabase();
  const from = dateFilter(filters.from);
  const to = dateFilter(filters.to, true);
  const q = filters.q?.trim().slice(0, 200);
  return getDb().institutionalDocument.findMany({
    where: {
      AND: [
        institutionalDocumentAccessWhere(actor),
        { status: filters.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE" },
        ...(filters.documentType ? [{ documentType: filters.documentType }] : []),
        ...(filters.accessLevel ? [{ accessLevel: filters.accessLevel }] : []),
        ...(filters.branchId ? [{ branchId: filters.branchId }] : []),
        ...(filters.departmentId ? [{ responsibleDepartmentId: filters.departmentId }] : []),
        ...(from || to ? [{ documentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }] : []),
        ...(q ? [{ OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { documentNumber: { contains: q, mode: "insensitive" as const } },
          { summary: { contains: q, mode: "insensitive" as const } },
        ] }] : []),
      ],
    },
    include: {
      branch: { select: { id: true, regionName: true } },
      responsibleDepartment: { select: { id: true, nameKk: true } },
      creator: { select: { profile: { select: { fullName: true } } } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true, originalName: true, sizeBytes: true } },
      _count: { select: { versions: true } },
    },
    orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

export async function getInstitutionalDocument(id: string) {
  await ensureDatabase();
  return getDb().institutionalDocument.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, regionName: true } },
      responsibleDepartment: { select: { id: true, nameKk: true } },
      creator: { select: { profile: { select: { fullName: true } } } },
      updater: { select: { profile: { select: { fullName: true } } } },
      versions: {
        include: { uploader: { select: { profile: { select: { fullName: true } } } } },
        orderBy: { versionNumber: "desc" },
      },
    },
  });
}

export async function getInstitutionalDocumentOptions(actor: AppUser) {
  await ensureDatabase();
  const database = getDb();
  const global = canManageGlobalInstitutionalDocuments(actor);
  const branches = global ? undefined : canManageBranchInstitutionalDocuments(actor) ? branchScopeIds(actor) : [];
  const departments = global ? undefined : canManageDepartmentInstitutionalDocuments(actor) ? institutionalDocumentDepartmentScopeIds(actor) : [];
  const [branchOptions, departmentOptions] = await Promise.all([
    database.branch.findMany({
      where: { status: "active", archivedAt: null, ...(branches ? { id: { in: branches } } : {}) },
      select: { id: true, regionName: true }, orderBy: { regionName: "asc" },
    }),
    database.department.findMany({
      where: { archivedAt: null, ...(departments ? { id: { in: departments } } : {}) },
      select: { id: true, nameKk: true }, orderBy: { nameKk: "asc" },
    }),
  ]);
  return { branches: branchOptions, departments: departmentOptions };
}
