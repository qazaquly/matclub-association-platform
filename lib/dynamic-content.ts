export const dynamicContentKinds = ["news", "publications", "partners", "projects"] as const;
export type DynamicContentKind = (typeof dynamicContentKinds)[number];

export const dynamicContentMeta: Record<DynamicContentKind, { singular: string; plural: string; publicHref: string }> = {
  news: { singular: "Жаңалық", plural: "Жаңалықтар", publicHref: "/news" },
  publications: { singular: "Жарияланым", plural: "Жарияланымдар", publicHref: "/publications" },
  partners: { singular: "Серіктес", plural: "Серіктестер", publicHref: "/partners" },
  projects: { singular: "Жоба", plural: "Ашық жобалар", publicHref: "/projects" },
};

export function isDynamicContentKind(value: string): value is DynamicContentKind {
  return (dynamicContentKinds as readonly string[]).includes(value);
}

function text(form: FormData, key: string, maxLength: number, required = false) {
  const value = String(form.get(key) ?? "").trim();
  if ((required && !value) || value.length > maxLength) throw new Error(`INVALID_CONTENT:${key}`);
  return value || null;
}

function restrictedMarkdown(form: FormData, key: string) {
  const value = text(form, key, 30_000, true)!;
  if (/<\s*(script|iframe|object|embed|style)\b/i.test(value) || /javascript\s*:/i.test(value)) {
    throw new Error(`INVALID_CONTENT:${key}`);
  }
  return value;
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("kk-KZ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function slug(form: FormData, title: string) {
  const value = normalizeSlug(String(form.get("slug") ?? "") || title);
  if (!value || value.length > 120) throw new Error("INVALID_CONTENT:slug");
  return value;
}

export function safePublicUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    // The validation error below is intentionally generic.
  }
  throw new Error("INVALID_CONTENT:url");
}

function integer(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "0").trim();
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < -10_000 || value > 10_000) throw new Error(`INVALID_CONTENT:${key}`);
  return value;
}

function optionalDate(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`INVALID_CONTENT:${key}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_CONTENT:${key}`);
  return date;
}

interface PartnerFormValues { name: string; description: string; websiteUrl: string | null; displayOrder: number }
interface NewsFormValues { title: string; slug: string; body: string; bodyFormat: string; lead: string; authorText: string | null }
interface PublicationFormValues { title: string; slug: string; body: string; bodyFormat: string; summary: string; authorText: string | null; publicationDate: Date | null; resourceUrl: string | null }
interface ProjectFormValues { title: string; slug: string; body: string; bodyFormat: string; summary: string; displayOrder: number; publicStartDate: Date | null; publicEndDate: Date | null }

export function parseDynamicContentForm(kind: "partners", form: FormData): PartnerFormValues;
export function parseDynamicContentForm(kind: "news", form: FormData): NewsFormValues;
export function parseDynamicContentForm(kind: "publications", form: FormData): PublicationFormValues;
export function parseDynamicContentForm(kind: "projects", form: FormData): ProjectFormValues;
export function parseDynamicContentForm(kind: DynamicContentKind, form: FormData): PartnerFormValues | NewsFormValues | PublicationFormValues | ProjectFormValues {
  if (kind === "partners") {
    return {
      name: text(form, "name", 180, true)!,
      description: text(form, "description", 1_000, true)!,
      websiteUrl: safePublicUrl(text(form, "websiteUrl", 1_000)),
      displayOrder: integer(form, "displayOrder"),
    };
  }

  const title = text(form, "title", 220, true)!;
  const common = {
    title,
    slug: slug(form, title),
    body: restrictedMarkdown(form, "body"),
    bodyFormat: "restricted_markdown",
  };

  if (kind === "news") return {
    ...common,
    lead: text(form, "summary", 700, true)!,
    authorText: text(form, "authorText", 220),
  };

  if (kind === "publications") return {
    ...common,
    summary: text(form, "summary", 700, true)!,
    authorText: text(form, "authorText", 220),
    publicationDate: optionalDate(form, "publicationDate"),
    resourceUrl: safePublicUrl(text(form, "resourceUrl", 1_000)),
  };

  const publicStartDate = optionalDate(form, "publicStartDate");
  const publicEndDate = optionalDate(form, "publicEndDate");
  if (publicStartDate && publicEndDate && publicEndDate < publicStartDate) throw new Error("INVALID_CONTENT:dates");
  return {
    ...common,
    summary: text(form, "summary", 700, true)!,
    displayOrder: integer(form, "displayOrder"),
    publicStartDate,
    publicEndDate,
  };
}

export function dynamicStatusLabel(status: string) {
  return ({ DRAFT: "Жоба", PUBLISHED: "Жарияланған", ARCHIVED: "Архив", active: "Белсенді", inactive: "Жасырын" } as Record<string, string>)[status] ?? status;
}

export function automaticDeletionDate(kind: DynamicContentKind, item: { status: string; archivedAt?: Date | null; publishedAt?: Date | null }) {
  if (item.status !== "ARCHIVED" || !item.archivedAt) return null;
  const eligible = kind === "news" || ((kind === "publications" || kind === "projects") && !item.publishedAt);
  return eligible ? new Date(item.archivedAt.getTime() + 60 * 86_400_000) : null;
}

export function serializeAuditValue(value: unknown) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item);
}
