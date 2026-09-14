export const registrationStatuses = ["REGISTERED", "CANCELLED"] as const;
export const attendanceStatuses = ["PENDING", "PRESENT", "ABSENT"] as const;
export const participantTypes = ["MEMBER", "INVITED_GUEST"] as const;

export function registrationStatusLabel(status: string) {
  return ({ REGISTERED: "Тіркелген", CANCELLED: "Бас тартқан" } as Record<string, string>)[status] ?? status;
}

export function attendanceStatusLabel(status: string) {
  return ({ PENDING: "Белгіленбеген", PRESENT: "Қатысты", ABSENT: "Қатыспады" } as Record<string, string>)[status] ?? status;
}

export function participantTypeLabel(type: string) {
  return ({ MEMBER: "Мүше", INVITED_GUEST: "Шақырылған қонақ" } as Record<string, string>)[type] ?? type;
}

export function registrationIsOpen(event: { status: string; startAt: Date; registrationMode: string }, now = new Date()) {
  return event.status === "PUBLISHED" && event.registrationMode === "INTERNAL_MEMBERS" && event.startAt > now;
}

export function cleanText(form: FormData, key: string, maxLength: number, required = false) {
  const value = String(form.get(key) ?? "").trim();
  if ((required && !value) || value.length > maxLength) throw new Error(`INVALID_PARTICIPANT:${key}`);
  return value || null;
}

export function parseSeatLayout(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 30) throw new Error("INVALID_SEATING:too_many_units");
  const seen = new Set<string>();
  return lines.map((line, index) => {
    const match = /^(.{1,12}):\s*(\d{1,3})$/.exec(line);
    if (!match) throw new Error("INVALID_SEATING:layout");
    const label = match[1].trim();
    const normalized = label.toLocaleLowerCase("kk-KZ");
    const seatCount = Number(match[2]);
    if (!label || seen.has(normalized) || seatCount < 1 || seatCount > 200) throw new Error("INVALID_SEATING:layout");
    seen.add(normalized);
    return { id: crypto.randomUUID(), label, seatCount, sortOrder: (index + 1) * 10 };
  });
}
