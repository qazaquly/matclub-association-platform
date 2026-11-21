import type { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";

export type FeatureKind = "news" | "publications" | "projects" | "events";
function slot(kind: FeatureKind) {
  return kind === "events" ? "selection.home.event" : "selection.home.story";
}

export async function selectedHomeItem(kind: FeatureKind) {
  await ensureDatabase();
  const row = await getDb().publicContent.findUnique({ where: { key: slot(kind) }, select: { value: true } });
  return row?.value;
}

export async function updateHomeSelection(tx: Prisma.TransactionClient, kind: FeatureKind, id: string, actorId: string, form: FormData) {
  const key = slot(kind);
  const value = kind + "/" + id;
  if (form.get("featureHome") === "on" && form.get("wasFeatured") !== "yes") {
    await tx.publicContent.upsert({ where: { key }, create: { key, value, updatedBy: actorId, section: "Басты бет", valueType: "reference" }, update: { value, updatedBy: actorId } });
  } else if (form.get("wasFeatured") === "yes" && !form.has("featureHome")) {
    await tx.publicContent.deleteMany({ where: { key, value } });
  }
}

export async function getHomeStory() {
  const reference = await selectedHomeItem("publications");
  if (!reference) return null;
  const [kind, id] = reference.split("/");
  if (!id) return null;
  const where = { id, status: "PUBLISHED", archivedAt: null, publishedAt: { not: null } };
  const select = { title: true, slug: true, coverMediaId: true, publishedAt: true };
  const db = getDb();
  if (kind === "news") {
    const item = await db.news.findFirst({ where, select: { ...select, lead: true } });
    return item && { ...item, kind, summary: item.lead, section: "Жаңалықтар", href: "/news/" + item.slug };
  }
  if (kind !== "publications" && kind !== "projects") return null;
  const query = { where, select: { ...select, summary: true } };
  const item = kind === "projects" ? await db.publicProject.findFirst(query) : await db.publication.findFirst(query);
  return item && { ...item, kind, section: kind === "projects" ? "Жобалар" : "Материалдар", href: "/" + kind + "/" + item.slug };
}
