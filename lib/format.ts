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

export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("kk-KZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
