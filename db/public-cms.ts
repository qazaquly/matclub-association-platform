import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";
import type { DynamicContentKind } from "@/lib/dynamic-content";

export async function listAdminDynamicContent(kind: DynamicContentKind) {
  await ensureDatabase();
  const database = getDb();
  if (kind === "news") return database.news.findMany({ include: { coverMedia: true }, orderBy: { updatedAt: "desc" } });
  if (kind === "publications") return database.publication.findMany({ include: { coverMedia: true }, orderBy: { updatedAt: "desc" } });
  if (kind === "projects") return database.publicProject.findMany({ include: { coverMedia: true }, orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }] });
  return database.partner.findMany({ include: { logoMedia: true }, orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }] });
}

export async function getAdminDynamicContent(kind: DynamicContentKind, id: string) {
  await ensureDatabase();
  const database = getDb();
  if (kind === "news") return database.news.findUnique({ where: { id }, include: { coverMedia: true } });
  if (kind === "publications") return database.publication.findUnique({ where: { id }, include: { coverMedia: true } });
  if (kind === "projects") return database.publicProject.findUnique({ where: { id }, include: { coverMedia: true } });
  return database.partner.findUnique({ where: { id }, include: { logoMedia: true } });
}

export async function listPublishedNews() {
  await ensureDatabase();
  return getDb().news.findMany({
    where: { status: "PUBLISHED", archivedAt: null, publishedAt: { not: null } },
    include: { coverMedia: true }, orderBy: { publishedAt: "desc" },
  });
}

export async function getPublishedNews(slug: string) {
  await ensureDatabase();
  return getDb().news.findFirst({
    where: { slug, status: "PUBLISHED", archivedAt: null },
    include: {
      coverMedia: true,
      eventLinks: {
        include: { event: { select: { slug: true, title: true, status: true, publishedAt: true, archivedAt: true } } },
      },
    },
  });
}

export async function listPublishedPublications() {
  await ensureDatabase();
  return getDb().publication.findMany({
    where: { status: "PUBLISHED", archivedAt: null, publishedAt: { not: null } }, include: { coverMedia: true },
    orderBy: [{ publicationDate: "desc" }, { publishedAt: "desc" }],
  });
}

export async function getPublishedPublication(slug: string) {
  await ensureDatabase();
  return getDb().publication.findFirst({ where: { slug, status: "PUBLISHED", archivedAt: null }, include: { coverMedia: true } });
}

export async function listActivePartners() {
  await ensureDatabase();
  return getDb().partner.findMany({ where: { status: "active" }, include: { logoMedia: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
}

export async function listPublishedProjects() {
  await ensureDatabase();
  return getDb().publicProject.findMany({
    where: { status: "PUBLISHED", archivedAt: null, publishedAt: { not: null } }, include: { coverMedia: true },
    orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }],
  });
}

export async function getPublishedProject(slug: string) {
  await ensureDatabase();
  return getDb().publicProject.findFirst({ where: { slug, status: "PUBLISHED", archivedAt: null }, include: { coverMedia: true } });
}
