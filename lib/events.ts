import { normalizeSlug, safePublicUrl } from "@/lib/dynamic-content";

export const eventScopes = ["NATIONAL", "BRANCH"] as const;
export const eventFormats = ["OFFLINE", "ONLINE", "HYBRID"] as const;
export const eventRegistrationModes = ["NONE", "EXTERNAL_LINK", "INTERNAL_MEMBERS"] as const;
export const eventSeatingTypes = ["NONE", "ROWS", "TABLES", "FREE"] as const;
export const eventStatuses = ["DRAFT", "SUBMITTED", "PUBLISHED", "POSTPONED", "CANCELLED", "COMPLETED", "ARCHIVED"] as const;
export const publicEventStatuses = ["PUBLISHED", "POSTPONED", "CANCELLED", "COMPLETED"] as const;
export const eventNewsRelationTypes = ["EVENT_ANNOUNCEMENT", "EVENT_RESULT"] as const;

export type EventNewsRelationType = (typeof eventNewsRelationTypes)[number];

function text(form: FormData, key: string, maxLength: number, required = false) {
  const value = String(form.get(key) ?? "").trim();
  if ((required && !value) || value.length > maxLength) throw new Error(`INVALID_EVENT:${key}`);
  return value || null;
}

function markdown(form: FormData, key: string) {
  const value = text(form, key, 30_000, true)!;
  if (/<\s*(script|iframe|object|embed|style)\b/i.test(value) || /javascript\s*:/i.test(value)) {
    throw new Error(`INVALID_EVENT:${key}`);
  }
  return value;
}

function localDateTime(form: FormData, key: string) {
  const value = text(form, key, 30, true)!;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error(`INVALID_EVENT:${key}`);
  const parsed = new Date(`${value}:00+05:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`INVALID_EVENT:${key}`);
  return parsed;
}

function optionalPositiveInteger(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) throw new Error(`INVALID_EVENT:${key}`);
  return value;
}

export function parseEventForm(form: FormData) {
  const title = text(form, "title", 220, true)!;
  const slug = normalizeSlug(String(form.get("slug") ?? "") || title);
  if (!slug) throw new Error("INVALID_EVENT:slug");
  const startAt = localDateTime(form, "startAt");
  const endAt = localDateTime(form, "endAt");
  if (endAt < startAt) throw new Error("INVALID_EVENT:dates");

  const eventScope = String(form.get("eventScope") ?? "");
  const eventFormat = String(form.get("eventFormat") ?? "");
  const registrationMode = String(form.get("registrationMode") ?? "NONE");
  if (!(eventScopes as readonly string[]).includes(eventScope)) throw new Error("INVALID_EVENT:eventScope");
  if (!(eventFormats as readonly string[]).includes(eventFormat)) throw new Error("INVALID_EVENT:eventFormat");
  if (!(eventRegistrationModes as readonly string[]).includes(registrationMode)) throw new Error("INVALID_EVENT:registrationMode");
  const seatingType = String(form.get("seatingType") ?? "NONE");
  if (!(eventSeatingTypes as readonly string[]).includes(seatingType)) throw new Error("INVALID_EVENT:seatingType");

  const branchId = eventScope === "BRANCH" ? text(form, "branchId", 120, true) : null;
  const venue = text(form, "venue", 500);
  const onlineUrl = safePublicUrl(text(form, "onlineUrl", 1_000));
  if ((eventFormat === "OFFLINE" || eventFormat === "HYBRID") && !venue) throw new Error("INVALID_EVENT:venue");
  if ((eventFormat === "ONLINE" || eventFormat === "HYBRID") && !onlineUrl) throw new Error("INVALID_EVENT:onlineUrl");

  const externalRegistrationUrl = safePublicUrl(text(form, "externalRegistrationUrl", 1_000));
  if (registrationMode === "EXTERNAL_LINK" && !externalRegistrationUrl) throw new Error("INVALID_EVENT:externalRegistrationUrl");
  const participantLimit = registrationMode === "INTERNAL_MEMBERS" ? optionalPositiveInteger(form, "participantLimit") : null;

  return {
    title,
    slug,
    summary: text(form, "summary", 700, true)!,
    description: markdown(form, "description"),
    bodyFormat: "restricted_markdown",
    startAt,
    endAt,
    eventScope,
    branchId,
    regionName: text(form, "regionName", 180),
    venue,
    eventFormat,
    onlineUrl,
    audience: text(form, "audience", 1_000, true)!,
    organizer: text(form, "organizer", 500, true)!,
    responsibleProfileId: text(form, "responsibleProfileId", 120),
    responsibleDepartmentId: text(form, "responsibleDepartmentId", 120),
    registrationMode,
    externalRegistrationUrl,
    participantLimit,
    seatingType,
  };
}

function optionalNonNegativeInteger(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new Error(`INVALID_EVENT_RESULT:${key}`);
  return value;
}

export function parseEventResultForm(form: FormData) {
  return {
    summary: text(form, "summary", 1_500, true)!,
    participantCount: optionalNonNegativeInteger(form, "participantCount"),
    audienceDescription: text(form, "audienceDescription", 3_000),
    mainTopics: text(form, "mainTopics", 5_000),
    outcomes: text(form, "outcomes", 5_000),
    decisions: text(form, "decisions", 5_000),
    speakers: text(form, "speakers", 3_000),
    notes: text(form, "notes", 5_000),
    materialReferences: text(form, "materialReferences", 5_000),
  };
}

export function eventStatusLabel(status: string) {
  return ({
    DRAFT: "Жоба",
    SUBMITTED: "Жариялауға жіберілді",
    PUBLISHED: "Жарияланған",
    POSTPONED: "Кейінге қалдырылды",
    CANCELLED: "Болдырылмады",
    COMPLETED: "Аяқталды",
    ARCHIVED: "Архив",
  } as Record<string, string>)[status] ?? status;
}

export function eventScopeLabel(scope: string) {
  return scope === "NATIONAL" ? "Республикалық" : "Филиалдық";
}

export function eventFormatLabel(format: string) {
  return ({ OFFLINE: "Офлайн", ONLINE: "Онлайн", HYBRID: "Аралас" } as Record<string, string>)[format] ?? format;
}

export function registrationModeLabel(mode: string) {
  return ({ NONE: "Тіркелусіз", EXTERNAL_LINK: "Сыртқы сілтеме", INTERNAL_MEMBERS: "Мүшелер үшін ішкі тіркелу" } as Record<string, string>)[mode] ?? mode;
}

export function seatingTypeLabel(type: string) {
  return ({ NONE: "Орын бөлінбейді", ROWS: "Қатарлар", TABLES: "Үстелдер", FREE: "Еркін отыру" } as Record<string, string>)[type] ?? type;
}

export function isPublicEventStatus(status: string) {
  return (publicEventStatuses as readonly string[]).includes(status);
}

export function isEventNewsRelationType(value: string): value is EventNewsRelationType {
  return (eventNewsRelationTypes as readonly string[]).includes(value);
}

export function dateTimeLocalValue(value?: Date | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function eventLocation(event: { eventFormat: string; venue: string | null; regionName: string | null; branch?: { regionName: string } | null }) {
  if (event.eventFormat === "ONLINE") return "Онлайн";
  return [event.venue, event.regionName ?? event.branch?.regionName].filter(Boolean).join(" · ") || "Өтетін орны нақтыланады";
}
