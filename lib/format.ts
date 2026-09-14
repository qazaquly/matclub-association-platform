const statusMap: Record<string, string> = {
  registered_user: "Тіркелген пайдаланушы",
  applicant: "Үміткер",
  awaiting_review: "Қаралуда",
  reserve: "Резерв",
  member: "Мүше",
  approved: "Мақұлданды",
  rejected: "Қабылданбады",
  suspended: "Тоқтатылған",
  former_member: "Бұрынғы мүше",
  active: "Белсенді",
  inactive: "Белсенді емес",
  archived: "Мұрағатта",
};

export function statusLabel(status: string) {
  return statusMap[status] ?? status;
}

const kazakhMonths = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];

export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(parsed);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = Number(valueOf("day"));
  const month = kazakhMonths[Number(valueOf("month")) - 1];
  const year = valueOf("year");
  if (!day || !month || !year) return "—";
  const date = `${day} ${month} ${year} ж.`;
  return includeTime ? `${date}, ${valueOf("hour")}:${valueOf("minute")}` : date;
}
