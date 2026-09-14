import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";
import { branchScopeIds, isFullAccess } from "@/lib/authorization";
import { eventScopeLabel, eventStatusLabel } from "@/lib/events";
import { statusLabel } from "@/lib/format";
import { projectScopeLabel, projectStatusLabel } from "@/lib/projects";
import type { AppUser } from "@/lib/types";

export const reportKinds = ["members", "applications", "events", "projects"] as const;
export type ReportKind = (typeof reportKinds)[number];

export interface ReportFilters {
  kind: ReportKind;
  branchId?: string;
  status?: string;
  query?: string;
  from?: string;
  to?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ReportData {
  kind: ReportKind;
  title: string;
  periodLabel: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  summary: Array<{ label: string; value: number }>;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value?: string) {
  if (!value || !isoDate.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function normalizeReportFilters(input: Record<string, string | undefined>): ReportFilters {
  const kind = reportKinds.includes(input.kind as ReportKind) ? input.kind as ReportKind : "members";
  return {
    kind,
    branchId: input.branchId?.trim() || undefined,
    status: input.status?.trim() || undefined,
    query: input.q?.trim().slice(0, 120) || undefined,
    from: validDate(input.from) ? input.from : undefined,
    to: validDate(input.to) ? input.to : undefined,
  };
}

function period(filters: ReportFilters) {
  const from = validDate(filters.from);
  const to = validDate(filters.to);
  const endExclusive = to ? new Date(to) : null;
  endExclusive?.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    from,
    endExclusive,
    label: from || to ? `${filters.from ?? "басы"} - ${filters.to ?? "бүгін"}` : "Барлық кезең",
  };
}

function allowedBranchIds(actor: AppUser, requested?: string) {
  if (isFullAccess(actor)) return requested ? [requested] : null;
  const scoped = branchScopeIds(actor);
  return requested ? scoped.filter((id) => id === requested) : scoped;
}

function dateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function ageValue(birthDate: Date | null, birthYear: number | null) {
  if (!birthDate) return birthYear ? new Date().getUTCFullYear() - birthYear : "";
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (now.getUTCMonth() < birthDate.getUTCMonth() || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function queryVariants(value?: string) {
  if (!value) return [];
  const lower = value.toLocaleLowerCase("kk-KZ");
  const upper = value.toLocaleUpperCase("kk-KZ");
  const title = lower.replace(/(^|\s)\S/g, (character) => character.toLocaleUpperCase("kk-KZ"));
  return [...new Set([value, lower, upper, title])];
}

function containsAny(fields: string[], query?: string) {
  const variants = queryVariants(query);
  if (!variants.length) return undefined;
  return variants.flatMap((variant) => fields.map((field) => ({ [field]: { contains: variant } })));
}

export async function buildReport(actor: AppUser, filters: ReportFilters): Promise<ReportData> {
  await ensureDatabase();
  const database = getDb();
  const branches = allowedBranchIds(actor, filters.branchId);
  const range = period(filters);

  if (filters.kind === "members") {
    const rows = await database.personProfile.findMany({
      where: {
        archivedAt: null,
        membershipStatus: filters.status && filters.status !== "rejected" ? filters.status : { not: "rejected" },
        ...(branches ? { branchId: { in: branches } } : {}),
        ...(containsAny(["fullName", "email", "workplace", "position", "cityDistrict", "mathSpecialization"], filters.query) ? { OR: containsAny(["fullName", "email", "workplace", "position", "cityDistrict", "mathSpecialization"], filters.query) } : {}),
        ...(range.from || range.endExclusive ? { membershipStartedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } } : {}),
      },
      include: {
        branch: { select: { regionName: true } },
        professionalCategories: { where: { removedAt: null }, include: { category: { select: { name: true } } } },
      },
      orderBy: { fullName: "asc" },
      take: 5000,
    });
    const mapped = rows.map((row) => ({
      fullName: row.fullName, age: ageValue(row.birthDate, row.birthYear), email: row.email, phone: row.phone,
      branch: row.branch?.regionName ?? "", city: row.cityDistrict, workplace: row.workplace ?? "", position: row.position ?? "",
      categories: row.professionalCategories.map((item) => item.category.name).join(", "), status: statusLabel(row.membershipStatus), joinedAt: dateValue(row.membershipStartedAt),
    }));
    return {
      kind: filters.kind, title: "Мүшелер мен профильдер есебі", periodLabel: range.label,
      columns: [
        { key: "fullName", label: "Аты-жөні" }, { key: "age", label: "Жасы", numeric: true }, { key: "email", label: "Email" }, { key: "phone", label: "Телефон" },
        { key: "branch", label: "Өңір" }, { key: "city", label: "Қала / аудан" }, { key: "workplace", label: "Жұмыс орны" }, { key: "position", label: "Лауазымы" },
        { key: "categories", label: "Кәсіби санаттар" }, { key: "status", label: "Мәртебе" }, { key: "joinedAt", label: "Мүшелік басталған күн" },
      ],
      rows: mapped,
      summary: [{ label: "Барлығы", value: mapped.length }, { label: "Мүшелер", value: rows.filter((row) => row.membershipStatus === "member").length }, { label: "Өңір саны", value: new Set(rows.map((row) => row.branchId).filter(Boolean)).size }],
    };
  }

  if (filters.kind === "applications") {
    const rows = await database.membershipApplication.findMany({
      where: {
        archivedAt: null, person: { archivedAt: null }, ...(branches ? { branchId: { in: branches } } : {}), ...(filters.status ? { status: filters.status } : {}),
        ...(containsAny(["fullName", "email", "workplace", "position", "cityDistrict"], filters.query) ? { person: { archivedAt: null, OR: containsAny(["fullName", "email", "workplace", "position", "cityDistrict"], filters.query) } } : {}),
        ...(range.from || range.endExclusive ? { submittedAt: { ...(range.from ? { gte: range.from } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } } : {}),
      },
      include: { branch: { select: { regionName: true } }, person: true }, orderBy: { submittedAt: "desc" }, take: 5000,
    });
    const mapped = rows.map((row) => ({
      submittedAt: dateValue(row.submittedAt), fullName: row.person.fullName, email: row.person.email, phone: row.person.phone,
      branch: row.branch.regionName, city: row.person.cityDistrict, workplace: row.person.workplace ?? "", position: row.person.position ?? "",
      status: statusLabel(row.status), reviewedAt: dateValue(row.reviewedAt), reason: row.decisionReason ?? "",
    }));
    return {
      kind: filters.kind, title: "Мүшелік өтініштер есебі", periodLabel: range.label,
      columns: [
        { key: "submittedAt", label: "Берілген күн" }, { key: "fullName", label: "Аты-жөні" }, { key: "email", label: "Email" }, { key: "phone", label: "Телефон" },
        { key: "branch", label: "Өңір" }, { key: "city", label: "Қала / аудан" }, { key: "workplace", label: "Жұмыс орны" }, { key: "position", label: "Лауазымы" },
        { key: "status", label: "Шешім" }, { key: "reviewedAt", label: "Қаралған күн" }, { key: "reason", label: "Шешім негізі" },
      ],
      rows: mapped,
      summary: [{ label: "Барлығы", value: mapped.length }, { label: "Қаралуда", value: rows.filter((row) => row.status === "awaiting_review").length }, { label: "Мақұлданған", value: rows.filter((row) => row.status === "approved").length }],
    };
  }

  if (filters.kind === "events") {
    const rows = await database.event.findMany({
      where: {
        archivedAt: null, ...(branches ? { branchId: { in: branches } } : {}), ...(filters.status ? { status: filters.status } : {}),
        ...(containsAny(["title", "summary", "organizer", "regionName", "venue"], filters.query) ? { OR: containsAny(["title", "summary", "organizer", "regionName", "venue"], filters.query) } : {}),
        ...(range.from || range.endExclusive ? { startAt: { ...(range.from ? { gte: range.from } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } } : {}),
      },
      include: { branch: { select: { regionName: true } }, result: { select: { participantCount: true } }, registrations: { where: { registrationStatus: "REGISTERED" }, select: { attendance: { select: { status: true } } } } },
      orderBy: { startAt: "desc" }, take: 5000,
    });
    const mapped = rows.map((row) => ({
      startAt: dateValue(row.startAt), title: row.title, scope: eventScopeLabel(row.eventScope), branch: row.branch?.regionName ?? row.regionName ?? "Республикалық",
      status: eventStatusLabel(row.status), organizer: row.organizer, registered: row.registrations.length,
      present: row.registrations.filter((registration) => registration.attendance?.status === "PRESENT").length,
      resultCount: row.result?.participantCount ?? "",
    }));
    return {
      kind: filters.kind, title: "Іс-шаралар және қатысу есебі", periodLabel: range.label,
      columns: [
        { key: "startAt", label: "Күні" }, { key: "title", label: "Іс-шара" }, { key: "scope", label: "Деңгейі" }, { key: "branch", label: "Өңір" },
        { key: "status", label: "Мәртебе" }, { key: "organizer", label: "Ұйымдастырушы" }, { key: "registered", label: "Тіркелген", numeric: true },
        { key: "present", label: "Қатысқан", numeric: true }, { key: "resultCount", label: "Қорытындыдағы қатысушы", numeric: true },
      ],
      rows: mapped,
      summary: [{ label: "Іс-шара саны", value: mapped.length }, { label: "Тіркелгендер", value: mapped.reduce((sum, row) => sum + Number(row.registered), 0) }, { label: "Нақты қатысқандар", value: mapped.reduce((sum, row) => sum + Number(row.present), 0) }],
    };
  }

  const rows = await database.project.findMany({
    where: {
      archivedAt: null, ...(branches ? { AND: [{ OR: [{ branchId: { in: branches } }, { projectScope: "ALL_BRANCHES" }] }] } : {}), ...(filters.status ? { status: filters.status } : {}),
      ...(containsAny(["title", "summary", "code"], filters.query) ? { OR: containsAny(["title", "summary", "code"], filters.query) } : {}),
      ...(range.from || range.endExclusive ? { startDate: { ...(range.from ? { gte: range.from } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } } : {}),
    },
    include: {
      branch: { select: { regionName: true } }, responsibleDepartment: { select: { nameKk: true } }, leaderProfile: { select: { fullName: true } },
      result: { select: { beneficiaryCount: true } }, _count: { select: { participants: true, stages: true } },
    },
    orderBy: { startDate: "desc" }, take: 5000,
  });
  const mapped = rows.map((row) => ({
    startDate: dateValue(row.startDate), endDate: dateValue(row.endDate), title: row.title, code: row.code ?? "", scope: projectScopeLabel(row.projectScope),
    branch: row.projectScope === "ALL_BRANCHES" ? "Барлық филиал" : (row.branch?.regionName ?? "Республикалық"), department: row.responsibleDepartment?.nameKk ?? "", leader: row.leaderProfile?.fullName ?? "",
    status: projectStatusLabel(row.status), participants: row._count.participants, stages: row._count.stages, beneficiaries: row.result?.beneficiaryCount ?? "",
  }));
  return {
    kind: filters.kind, title: "Жобалар есебі", periodLabel: range.label,
    columns: [
      { key: "startDate", label: "Басталған күн" }, { key: "endDate", label: "Аяқталатын күн" }, { key: "title", label: "Жоба" }, { key: "code", label: "Код" },
      { key: "scope", label: "Деңгейі" }, { key: "branch", label: "Өңір" }, { key: "department", label: "Жауапты бөлім" }, { key: "leader", label: "Жетекші" },
      { key: "status", label: "Мәртебе" }, { key: "participants", label: "Қатысушылар", numeric: true }, { key: "stages", label: "Кезеңдер", numeric: true }, { key: "beneficiaries", label: "Қамтылғандар", numeric: true },
    ],
    rows: mapped,
    summary: [{ label: "Жоба саны", value: mapped.length }, { label: "Қатысушылар", value: mapped.reduce((sum, row) => sum + Number(row.participants), 0) }, { label: "Қамтылғандар", value: mapped.reduce((sum, row) => sum + Number(row.beneficiaries || 0), 0) }],
  };
}
