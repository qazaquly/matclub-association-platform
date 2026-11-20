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

const auditActions: Record<string, string> = {
  "auth.login": "Жүйеге кірді", "auth.logout": "Жүйеден шықты",
  "account.password_reset": "Құпиясөзін жаңартты", "account.email_verified": "Поштасын растады",
  "account.registered": "Тіркелгі ашты", "account.unverified_email_changed": "Пошта мекенжайын өзгертті",
  "application.submitted": "Өтініш жіберді", "application.reopened": "Өтінішті қайта ашты",
  "application.reserve": "Резервке алды", "public_content.updated": "Сайт мәтінін өзгертті",
  "dynamic_content.published": "Материал жариялады", "dynamic_content.created": "Нобай сақтады",
  "dynamic_content.updated": "Материалды өңдеді", "dynamic_content.archived": "Материалды архивке алды",
  "event.created": "Іс-шараның нобайын сақтады", "event.published": "Іс-шараны жариялады",
  "event.submitted": "Іс-шараны қарауға жіберді", "project.created": "Жоба ашты",
  "branch.updated": "Филиал деректерін өзгертті", "role.granted": "Рөл берді", "role.revoked": "Рөлді алып тастады",
};

export function auditActionLabel(action: string) {
  return auditActions[action] ?? action;
}
