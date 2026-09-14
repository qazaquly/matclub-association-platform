import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";
import { canAccessBranch, canManageProjectDocuments, canReviewApplications, isFullAccess } from "@/lib/authorization";
import type { AppUser } from "@/lib/types";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | undefined) {
  if (!value || !isoDate.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

export function branchWorkspacePeriod(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  let start = validDate(from) ?? defaultFrom;
  let end = validDate(to) ?? defaultTo;
  if (end < start) [start, end] = [end, start];
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    start,
    endExclusive,
  };
}

export async function getBranchWorkspace(actor: AppUser, branchId: string, from?: string, to?: string) {
  await ensureDatabase();
  if (!canReviewApplications(actor) || !canAccessBranch(actor, branchId)) return null;

  const database = getDb();
  const period = branchWorkspacePeriod(from, to);
  const dateRange = { gte: period.start, lt: period.endExclusive };
  const projectDocumentAccess = canManageProjectDocuments(actor);
  const branchProjectScope = { AND: [{ OR: [{ branchId }, { projectScope: "ALL_BRANCHES" }] }] };

  const branch = await database.branch.findFirst({
    where: { id: branchId, archivedAt: null },
    include: {
      directorProfile: { select: { id: true, fullName: true } },
      staff: {
        where: { activeTo: null },
        include: { user: { include: { profile: { select: { id: true, fullName: true } } } } },
        orderBy: { activeFrom: "asc" },
      },
    },
  });
  if (!branch) return null;

  const [
    memberGroups,
    recentMembers,
    applicationGroups,
    recentApplications,
    eventGroups,
    recentEvents,
    projectGroups,
    recentProjects,
    recentApplicationDocuments,
    recentProjectDocuments,
    recentInstitutionalDocuments,
    joinedMembers,
    submittedApplications,
    approvedApplications,
    completedEvents,
    eventRegistrations,
    eventAttendance,
    completedProjects,
    eventResultCount,
    projectResultCount,
    beneficiaryTotals,
  ] = await Promise.all([
    database.personProfile.groupBy({ by: ["membershipStatus"], where: { branchId, archivedAt: null, membershipStatus: { not: "rejected" } }, _count: true }),
    database.personProfile.findMany({
      where: { branchId, archivedAt: null, membershipStatus: "member" },
      select: { id: true, fullName: true, membershipStatus: true, workplace: true, position: true, membershipStartedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    database.personProfile.groupBy({ by: ["membershipStatus"], where: { branchId, archivedAt: null, membershipStatus: { in: ["registered_user", "applicant"] } }, _count: true }),
    database.personProfile.findMany({
      where: { branchId, archivedAt: null, membershipStatus: { in: ["registered_user", "applicant"] } },
      select: {
        id: true, fullName: true, workplace: true, membershipStatus: true, createdAt: true,
        applications: { where: { archivedAt: null }, select: { id: true, submittedAt: true }, orderBy: { submittedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    database.event.groupBy({ by: ["status"], where: { branchId, archivedAt: null }, _count: true }),
    database.event.findMany({
      where: { branchId, archivedAt: null },
      select: { id: true, title: true, status: true, startAt: true, endAt: true, result: { select: { participantCount: true } }, _count: { select: { registrations: true } } },
      orderBy: { startAt: "desc" },
      take: 6,
    }),
    database.project.groupBy({ by: ["status"], where: { ...branchProjectScope, archivedAt: null }, _count: true }),
    database.project.findMany({
      where: { ...branchProjectScope, archivedAt: null },
      select: { id: true, title: true, status: true, startDate: true, endDate: true, result: { select: { beneficiaryCount: true } }, _count: { select: { participants: true, stages: true, documents: true } } },
      orderBy: { startDate: "desc" },
      take: 6,
    }),
    database.uploadedDocument.findMany({
      where: { archivedAt: null, draftId: null, application: { branchId, archivedAt: null } },
      select: { id: true, originalName: true, sizeBytes: true, createdAt: true, applicationId: true, owner: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    projectDocumentAccess ? database.projectDocument.findMany({
      where: { archivedAt: null, project: { ...branchProjectScope, archivedAt: null } },
      select: { id: true, projectId: true, originalName: true, category: true, sizeBytes: true, createdAt: true, project: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }) : Promise.resolve([]),
    database.institutionalDocument.findMany({
      where: {
        branchId,
        status: "ACTIVE",
        ...(!isFullAccess(actor) ? { accessLevel: { in: ["RESPONSIBLE", "MEMBERS"] } } : {}),
      },
      select: {
        id: true, title: true, documentNumber: true, documentDate: true, documentType: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true, originalName: true } },
      },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    database.personProfile.count({ where: { branchId, archivedAt: null, membershipStartedAt: dateRange } }),
    database.membershipApplication.count({ where: { branchId, archivedAt: null, submittedAt: dateRange } }),
    database.membershipApplication.count({ where: { branchId, archivedAt: null, status: "approved", reviewedAt: dateRange } }),
    database.event.count({ where: { branchId, archivedAt: null, status: "COMPLETED", startAt: dateRange } }),
    database.eventRegistration.count({ where: { registrationStatus: "REGISTERED", event: { branchId, archivedAt: null, startAt: dateRange } } }),
    database.eventAttendance.count({ where: { status: "PRESENT", registration: { registrationStatus: "REGISTERED", event: { branchId, archivedAt: null, startAt: dateRange } } } }),
    database.project.count({ where: { ...branchProjectScope, archivedAt: null, status: "COMPLETED", startDate: { lt: period.endExclusive }, OR: [{ endDate: null }, { endDate: { gte: period.start } }] } }),
    database.eventResult.count({ where: { event: { branchId, archivedAt: null, startAt: dateRange } } }),
    database.projectResult.count({ where: { project: { ...branchProjectScope, archivedAt: null, startDate: { lt: period.endExclusive }, OR: [{ endDate: null }, { endDate: { gte: period.start } }] } } }),
    database.projectResult.aggregate({ where: { project: { ...branchProjectScope, archivedAt: null, startDate: { lt: period.endExclusive }, OR: [{ endDate: null }, { endDate: { gte: period.start } }] } }, _sum: { beneficiaryCount: true } }),
  ]);

  const counts = (groups: Array<{ [key: string]: unknown; _count: number }>, key: string) => Object.fromEntries(groups.map((group) => [String(group[key]), group._count]));

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      regionName: branch.regionName,
      status: branch.status,
      director: branch.directorProfile,
      staff: branch.staff.map((item) => ({ id: item.id, staffType: item.staffType, activeFrom: item.activeFrom, person: item.user.profile })),
    },
    period,
    membershipCounts: counts(memberGroups, "membershipStatus"),
    applicationCounts: counts(applicationGroups, "membershipStatus"),
    eventCounts: counts(eventGroups, "status"),
    projectCounts: counts(projectGroups, "status"),
    recentMembers,
    recentApplications,
    recentEvents,
    recentProjects,
    recentApplicationDocuments,
    recentProjectDocuments,
    recentInstitutionalDocuments,
    projectDocumentAccess,
    report: {
      joinedMembers,
      submittedApplications,
      approvedApplications,
      completedEvents,
      eventRegistrations,
      eventAttendance,
      completedProjects,
      eventResultCount,
      projectResultCount,
      beneficiaries: beneficiaryTotals._sum.beneficiaryCount ?? 0,
    },
  };
}
