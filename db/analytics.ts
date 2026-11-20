import { Prisma } from "@/generated/prisma/client";
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
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthBuckets(start: Date, endExclusive: Date) {
  const buckets: Array<{ key: string; label: string; members: number; events: number; projects: number }> = [];
  const last = new Date(endExclusive.getTime() - 1);
  const cursor = new Date(Math.max(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1), Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 23, 1)));
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
  const projectScope = { archivedAt: null, ...(branches ? { AND: [{ OR: [{ branchId: { in: branches } }, ...(branches.length ? [{ projectScope: "ALL_BRANCHES" }] : [])] }] } : {}) };
  const currentRange = { gte: period.start, lt: period.endExclusive };
  const previousRange = { gte: period.previousStart, lt: period.previousEndExclusive };

  // Keep aggregation in the database: an arbitrary row limit changes totals.
  const filterBranches = branches === null ? Prisma.empty : branches.length
    ? Prisma.sql`AND b.branch_id IN (${Prisma.join(branches)})` : Prisma.sql`AND FALSE`;
  const filterProjects = branches?.length
    ? Prisma.sql`AND (b.branch_id IN (${Prisma.join(branches)}) OR b.project_scope = 'ALL_BRANCHES')` : filterBranches;
  type CountRow = { key: string; total: number };
  function monthly(source: Prisma.Sql, date: Prisma.Sql, conditions: Prisma.Sql, scope: Prisma.Sql) {
    return database.$queryRaw<CountRow[]>`SELECT to_char(${date}, 'YYYY-MM') AS key, count(*)::int AS total
      FROM ${source} b WHERE b.archived_at IS NULL AND ${conditions} ${scope}
      AND ${date} >= ${period.start} AND ${date} < ${period.endExclusive} GROUP BY 1`;
  }
  const branchFilter = branches ? { in: branches } : { not: null };
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
    monthly(Prisma.sql`person_profiles`, Prisma.sql`b.membership_started_at`, Prisma.sql`b.membership_status = 'member'`, filterBranches),
    monthly(Prisma.sql`events`, Prisma.sql`b.start_at`, Prisma.sql`b.status = 'COMPLETED'`, filterBranches),
    monthly(Prisma.sql`projects`, Prisma.sql`b.start_date`, Prisma.sql`b.status = 'COMPLETED'`, filterProjects),
    database.branch.findMany({ where: { archivedAt: null, ...(branches ? { id: { in: branches } } : {}) }, select: { id: true, regionName: true }, orderBy: { regionName: "asc" } }),
    database.personProfile.groupBy({ by: ["branchId"], where: { ...profileScope, membershipStatus: "member", branchId: branchFilter }, _count: true }),
    database.personProfile.groupBy({ by: ["branchId"], where: { ...profileScope, membershipStatus: "member", membershipStartedAt: currentRange, branchId: branchFilter }, _count: true }),
    database.event.groupBy({ by: ["branchId"], where: { ...eventScope, status: "COMPLETED", startAt: currentRange, branchId: branchFilter }, _count: true }),
    database.$queryRaw<Array<CountRow & { present: number }>>`SELECT b.branch_id AS key, count(*)::int AS total,
      count(*) FILTER (WHERE a.status = 'PRESENT')::int AS present FROM events b
      JOIN event_registrations r ON r.event_id = b.id LEFT JOIN event_attendance a ON a.registration_id = r.id
      WHERE r.registration_status = 'REGISTERED' AND b.archived_at IS NULL AND b.branch_id IS NOT NULL ${filterBranches}
      AND b.start_at >= ${period.start} AND b.start_at < ${period.endExclusive} GROUP BY b.branch_id`,
    database.project.groupBy({ by: ["branchId"], where: { ...projectScope, status: "COMPLETED", startDate: currentRange, branchId: branchFilter }, _count: true }),
    database.$queryRaw<CountRow[]>`SELECT b.branch_id AS key, count(*)::int AS total FROM projects b
      JOIN project_participants p ON p.project_id = b.id WHERE p.status IN ('ACTIVE','COMPLETED')
      AND b.archived_at IS NULL AND b.branch_id IS NOT NULL ${filterBranches}
      AND b.start_date >= ${period.start} AND b.start_date < ${period.endExclusive} GROUP BY b.branch_id`,
    database.$queryRaw<CountRow[]>`SELECT b.branch_id AS key, coalesce(sum(r.beneficiary_count),0)::int AS total FROM projects b
      JOIN project_results r ON r.project_id = b.id WHERE b.archived_at IS NULL AND b.branch_id IS NOT NULL ${filterBranches}
      AND b.start_date >= ${period.start} AND b.start_date < ${period.endExclusive} GROUP BY b.branch_id`,
  ]);

  const approved = reviewedApplications.filter((item) => item.status === "approved").length;
  const months = monthBuckets(period.start, period.endExclusive);
  const monthMap = new Map(months.map((month) => [month.key, month]));
  for (const [field, groups] of [["members", monthlyMemberDates], ["events", monthlyEventDates], ["projects", monthlyProjectDates]] as const) {
    for (const row of groups) {
      const month = monthMap.get(row.key);
      if (month) month[field] = row.total;
    }
  }

  const byBranch = <T extends { branchId: string | null }>(groups: T[], value: (item: T) => number) => {
    const result = new Map<string, number>();
    for (const item of groups) if (item.branchId) result.set(item.branchId, (result.get(item.branchId) ?? 0) + value(item));
    return result;
  };
  const memberMap = byBranch(branchMemberGroups, (item) => item._count);
  const joinedMap = byBranch(branchJoinedGroups, (item) => item._count);
  const eventMap = byBranch(branchEventGroups, (item) => item._count);
  const registrationMap = new Map(branchRegistrations.map((row) => [row.key, row.total]));
  const attendanceMap = new Map(branchRegistrations.map((row) => [row.key, row.present]));
  const projectMap = byBranch(branchProjectGroups, (item) => item._count);
  const projectParticipantMap = new Map(branchProjectParticipants.map((row) => [row.key, row.total]));
  const beneficiaryMap = new Map(branchBeneficiaries.map((row) => [row.key, row.total]));
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
