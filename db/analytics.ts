import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";
import { branchScopeIds, isFullAccess } from "@/lib/authorization";
import { statusLabel } from "@/lib/format";
import type { AppUser } from "@/lib/types";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value?: string) {
  if (!value || !isoDate.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

export function analyticsPeriod(from?: string, to?: string) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start = validDate(from) ?? new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  let end = validDate(to) ?? today;
  if (end < start) [start, end] = [end, start];
  const endExclusive = new Date(end); endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const duration = endExclusive.getTime() - start.getTime();
  const previousEndExclusive = new Date(start);
  const previousStart = new Date(start.getTime() - duration);
  return {
    from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), start, endExclusive,
    previousStart, previousEndExclusive,
  };
}

function allowedBranches(actor: AppUser, requested?: string) {
  if (isFullAccess(actor)) return requested ? [requested] : null;
  const scoped = branchScopeIds(actor);
  return requested ? scoped.filter((id) => id === requested) : scoped;
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

function change(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthBuckets(start: Date, endExclusive: Date) {
  const buckets: Array<{ key: string; label: string; members: number; events: number; projects: number }> = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const monthNames = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];
  while (cursor < endExclusive && buckets.length < 24) {
    buckets.push({ key: monthKey(cursor), label: `${monthNames[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`, members: 0, events: 0, projects: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

export async function getManagementAnalytics(actor: AppUser, branchId?: string, from?: string, to?: string) {
  await ensureDatabase();
  const database = getDb();
  const period = analyticsPeriod(from, to);
  const branches = allowedBranches(actor, branchId);
  const profileScope = { archivedAt: null, membershipStatus: { not: "rejected" }, ...(branches ? { branchId: { in: branches } } : {}) };
  const applicationScope = { archivedAt: null, ...(branches ? { branchId: { in: branches } } : {}) };
  const eventScope = { archivedAt: null, ...(branches ? { branchId: { in: branches } } : {}) };
  const projectScope = { archivedAt: null, ...(branches ? { AND: [{ OR: [{ branchId: { in: branches } }, { projectScope: "ALL_BRANCHES" }] }] } : {}) };
  const currentRange = { gte: period.start, lt: period.endExclusive };
  const previousRange = { gte: period.previousStart, lt: period.previousEndExclusive };

  const [
    memberCount, joinedMembers, previousJoinedMembers, pendingApplications, submittedApplications, reviewedApplications,
    completedEvents, previousCompletedEvents, registrations, attendancePresent, activeProjects, completedProjects,
    previousCompletedProjects, projectParticipants, beneficiaryTotals, statusGroups, categoryGroups, categoryCatalog,
    monthlyMemberDates, monthlyEventDates, monthlyProjectDates, branchCatalog, branchMemberGroups, branchJoinedGroups,
    branchEventGroups, branchRegistrations, branchProjectGroups, branchProjectParticipants, branchBeneficiaries,
  ] = await Promise.all([
    database.personProfile.count({ where: { ...profileScope, membershipStatus: "member" } }),
    database.personProfile.count({ where: { ...profileScope, membershipStatus: "member", membershipStartedAt: currentRange } }),
    database.personProfile.count({ where: { ...profileScope, membershipStatus: "member", membershipStartedAt: previousRange } }),
    database.membershipApplication.count({ where: { ...applicationScope, status: "awaiting_review" } }),
    database.membershipApplication.count({ where: { ...applicationScope, submittedAt: currentRange } }),
    database.membershipApplication.findMany({ where: { ...applicationScope, reviewedAt: currentRange, status: { in: ["approved", "reserve", "rejected"] } }, select: { status: true } }),
    database.event.count({ where: { ...eventScope, status: "COMPLETED", startAt: currentRange } }),
    database.event.count({ where: { ...eventScope, status: "COMPLETED", startAt: previousRange } }),
    database.eventRegistration.count({ where: { registrationStatus: "REGISTERED", event: { ...eventScope, startAt: currentRange } } }),
    database.eventAttendance.count({ where: { status: "PRESENT", registration: { registrationStatus: "REGISTERED", event: { ...eventScope, startAt: currentRange } } } }),
    database.project.count({ where: { ...projectScope, status: "ACTIVE" } }),
    database.project.count({ where: { ...projectScope, status: "COMPLETED", startDate: currentRange } }),
    database.project.count({ where: { ...projectScope, status: "COMPLETED", startDate: previousRange } }),
    database.projectParticipant.count({ where: { status: { in: ["ACTIVE", "COMPLETED"] }, project: { ...projectScope, startDate: currentRange } } }),
    database.projectResult.aggregate({ where: { project: { ...projectScope, startDate: currentRange } }, _sum: { beneficiaryCount: true } }),
    database.personProfile.groupBy({ by: ["membershipStatus"], where: profileScope, _count: true }),
    database.personProfessionalCategoryAssignment.groupBy({ by: ["categoryId"], where: { removedAt: null, person: profileScope }, _count: true }),
    database.professionalCategory.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    database.personProfile.findMany({ where: { ...profileScope, membershipStatus: "member", membershipStartedAt: currentRange }, select: { membershipStartedAt: true }, take: 10000 }),
    database.event.findMany({ where: { ...eventScope, status: "COMPLETED", startAt: currentRange }, select: { startAt: true }, take: 10000 }),
    database.project.findMany({ where: { ...projectScope, status: "COMPLETED", startDate: currentRange }, select: { startDate: true }, take: 10000 }),
    database.branch.findMany({ where: { archivedAt: null, ...(branches ? { id: { in: branches } } : {}) }, select: { id: true, regionName: true }, orderBy: { regionName: "asc" } }),
    database.personProfile.groupBy({ by: ["branchId"], where: { ...profileScope, membershipStatus: "member", branchId: { not: null } }, _count: true }),
    database.personProfile.groupBy({ by: ["branchId"], where: { ...profileScope, membershipStatus: "member", membershipStartedAt: currentRange, branchId: { not: null } }, _count: true }),
    database.event.groupBy({ by: ["branchId"], where: { ...eventScope, status: "COMPLETED", startAt: currentRange, branchId: { not: null } }, _count: true }),
    database.eventRegistration.findMany({ where: { registrationStatus: "REGISTERED", event: { ...eventScope, startAt: currentRange, branchId: { not: null } } }, select: { event: { select: { branchId: true } }, attendance: { select: { status: true } } }, take: 20000 }),
    database.project.groupBy({ by: ["branchId"], where: { ...projectScope, status: "COMPLETED", startDate: currentRange, branchId: { not: null } }, _count: true }),
    database.projectParticipant.findMany({ where: { status: { in: ["ACTIVE", "COMPLETED"] }, project: { ...projectScope, startDate: currentRange, branchId: { not: null } } }, select: { project: { select: { branchId: true } } }, take: 20000 }),
    database.projectResult.findMany({ where: { project: { ...projectScope, startDate: currentRange, branchId: { not: null } } }, select: { beneficiaryCount: true, project: { select: { branchId: true } } }, take: 10000 }),
  ]);

  const approved = reviewedApplications.filter((item) => item.status === "approved").length;
  const months = monthBuckets(period.start, period.endExclusive);
  const monthMap = new Map(months.map((month) => [month.key, month]));
  for (const item of monthlyMemberDates) if (item.membershipStartedAt) { const month = monthMap.get(monthKey(item.membershipStartedAt)); if (month) month.members += 1; }
  for (const item of monthlyEventDates) { const month = monthMap.get(monthKey(item.startAt)); if (month) month.events += 1; }
  for (const item of monthlyProjectDates) { const month = monthMap.get(monthKey(item.startDate)); if (month) month.projects += 1; }

  const byBranch = <T extends { branchId: string | null }>(groups: T[], value: (item: T) => number) => {
    const result = new Map<string, number>();
    for (const item of groups) if (item.branchId) result.set(item.branchId, (result.get(item.branchId) ?? 0) + value(item));
    return result;
  };
  const memberMap = byBranch(branchMemberGroups, (item) => item._count);
  const joinedMap = byBranch(branchJoinedGroups, (item) => item._count);
  const eventMap = byBranch(branchEventGroups, (item) => item._count);
  const registrationMap = new Map<string, number>(); const attendanceMap = new Map<string, number>();
  for (const item of branchRegistrations) if (item.event.branchId) {
    registrationMap.set(item.event.branchId, (registrationMap.get(item.event.branchId) ?? 0) + 1);
    if (item.attendance?.status === "PRESENT") attendanceMap.set(item.event.branchId, (attendanceMap.get(item.event.branchId) ?? 0) + 1);
  }
  const projectMap = byBranch(branchProjectGroups, (item) => item._count);
  const projectParticipantMap = new Map<string, number>();
  for (const item of branchProjectParticipants) if (item.project.branchId) projectParticipantMap.set(item.project.branchId, (projectParticipantMap.get(item.project.branchId) ?? 0) + 1);
  const beneficiaryMap = new Map<string, number>();
  for (const item of branchBeneficiaries) if (item.project.branchId) beneficiaryMap.set(item.project.branchId, (beneficiaryMap.get(item.project.branchId) ?? 0) + (item.beneficiaryCount ?? 0));
  const branchRows = branchCatalog.map((branch) => ({
    id: branch.id, name: branch.regionName, members: memberMap.get(branch.id) ?? 0, joined: joinedMap.get(branch.id) ?? 0,
    events: eventMap.get(branch.id) ?? 0, registrations: registrationMap.get(branch.id) ?? 0, attendance: attendanceMap.get(branch.id) ?? 0,
    projects: projectMap.get(branch.id) ?? 0, projectParticipants: projectParticipantMap.get(branch.id) ?? 0, beneficiaries: beneficiaryMap.get(branch.id) ?? 0,
  })).sort((left, right) => (right.attendance + right.projectParticipants + right.beneficiaries) - (left.attendance + left.projectParticipants + left.beneficiaries) || right.events - left.events || left.name.localeCompare(right.name, "kk"));

  const categoryNames = new Map(categoryCatalog.map((item) => [item.id, item.name]));
  const categories = categoryGroups.map((item) => ({ label: categoryNames.get(item.categoryId) ?? "Белгісіз санат", value: item._count })).sort((left, right) => right.value - left.value);
  const membership = statusGroups.map((item) => ({ label: statusLabel(item.membershipStatus), value: item._count })).sort((left, right) => right.value - left.value);

  return {
    period: { from: period.from, to: period.to }, nationalView: isFullAccess(actor) && !branchId,
    metrics: {
      memberCount, joinedMembers, joinedChange: change(joinedMembers, previousJoinedMembers), pendingApplications, submittedApplications,
      approvalRate: percentage(approved, reviewedApplications.length), reviewedApplications: reviewedApplications.length, completedEvents, eventChange: change(completedEvents, previousCompletedEvents),
      registrations, attendancePresent, attendanceRate: percentage(attendancePresent, registrations), activeProjects, completedProjects,
      projectChange: change(completedProjects, previousCompletedProjects), projectParticipants, beneficiaries: beneficiaryTotals._sum.beneficiaryCount ?? 0,
    },
    months, membership, categories, branches: branchRows,
    attention: {
      branchesWithoutEvents: branchRows.filter((row) => row.events === 0).length,
      branchesWithoutProjects: branchRows.filter((row) => row.projects === 0).length,
      branchesWithoutNewMembers: branchRows.filter((row) => row.joined === 0).length,
    },
  };
}
