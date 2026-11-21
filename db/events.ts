import { selectedHomeItem } from "./home-feature";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { canManageGlobalEvents, eventBranchScopeIds } from "@/lib/authorization";
import { publicEventStatuses } from "@/lib/events";
import type { AppUser } from "@/lib/types";

const eventInclude = {
  branch: true,
  coverMedia: true,
  responsibleProfile: { select: { id: true, fullName: true, branchId: true } },
  responsibleDepartment: { select: { id: true, nameKk: true } },
  result: true,
  newsLinks: { include: { news: true }, orderBy: { createdAt: "asc" as const } },
} as const;

export async function listManagedEvents(actor: AppUser) {
  await ensureDatabase();
  const scopes = eventBranchScopeIds(actor);
  return getDb().event.findMany({
    where: canManageGlobalEvents(actor) ? {} : { branchId: { in: scopes } },
    include: eventInclude,
    orderBy: [{ startAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getManagedEvent(id: string) {
  await ensureDatabase();
  return getDb().event.findUnique({ where: { id }, include: eventInclude });
}

export async function getEventFormOptions(actor: AppUser) {
  await ensureDatabase();
  const database = getDb();
  const global = canManageGlobalEvents(actor);
  const scopes = eventBranchScopeIds(actor);
  const [branches, people, departments] = await Promise.all([
    database.branch.findMany({
      where: { archivedAt: null, status: "active", ...(global ? {} : { id: { in: scopes } }) },
      select: { id: true, regionName: true }, orderBy: { regionName: "asc" },
    }),
    database.personProfile.findMany({
      where: { archivedAt: null, ...(global ? {} : { branchId: { in: scopes } }) },
      select: { id: true, fullName: true, branchId: true }, orderBy: { fullName: "asc" },
    }),
    global ? database.department.findMany({ where: { archivedAt: null }, select: { id: true, nameKk: true }, orderBy: { nameKk: "asc" } }) : [],
  ]);
  return { branches, people, departments };
}

export async function listPublicEvents() {
  await ensureDatabase();
  return getDb().event.findMany({
    where: { status: { in: [...publicEventStatuses] }, publishedAt: { not: null }, archivedAt: null },
    include: {
      branch: { select: { id: true, regionName: true } }, coverMedia: true,
      newsLinks: { where: { news: { status: "PUBLISHED", archivedAt: null } }, include: { news: true } },
    },
    orderBy: [{ startAt: "asc" }, { title: "asc" }],
  });
}

export async function getPublicEvent(slug: string) {
  await ensureDatabase();
  return getDb().event.findFirst({
    where: { slug, status: { in: [...publicEventStatuses] }, publishedAt: { not: null }, archivedAt: null },
    include: {
      branch: true, coverMedia: true, responsibleProfile: { select: { fullName: true } },
      responsibleDepartment: { select: { nameKk: true } }, result: true,
      newsLinks: { where: { news: { status: "PUBLISHED", archivedAt: null } }, include: { news: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listHomeEvents(now = new Date()) {
  const reference = await selectedHomeItem("events");
  const pinnedId = reference?.startsWith("events/") ? reference.slice(7) : undefined;
  const where = { status: { in: ["PUBLISHED", "POSTPONED"] }, publishedAt: { not: null }, archivedAt: null, startAt: { gte: now } };
  const query = {
    select: { id: true, slug: true, title: true, summary: true, status: true, startAt: true, eventFormat: true, venue: true, regionName: true, branch: { select: { regionName: true } } },
    orderBy: [{ startAt: "asc" as const }, { id: "asc" as const }],
  };
  const db = getDb();
  const [pinned, next] = await Promise.all([
    pinnedId ? db.event.findFirst({ ...query, where: { ...where, id: pinnedId } }) : null,
    db.event.findMany({ ...query, where, take: 2 }),
  ]);
  return pinned ? [pinned, ...next.filter(event => event.id !== pinned.id)].slice(0, 2) : next;
}
