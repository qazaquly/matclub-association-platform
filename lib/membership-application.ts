import { z } from "zod";

export const educationLevels = [
  ["secondary", "Орта білім"],
  ["technical_vocational", "Техникалық және кәсіптік білім"],
  ["higher", "Жоғары білім"],
  ["masters", "Магистратура"],
  ["doctorate", "Докторантура"],
  ["other", "Басқа"],
] as const;

export const membershipDraftFieldNames = [
  "surname", "givenName", "patronymic", "birthDate", "regionCode", "cityDistrict", "phone",
  "workplace", "position", "educationLevelCode", "educationInstitution", "educationProgram",
  "mathSpecialization", "achievements", "joiningPurpose",
] as const;

export type MembershipDraftFieldName = (typeof membershipDraftFieldNames)[number];
export type MembershipFieldErrors = Partial<Record<MembershipDraftFieldName | "termsAccepted" | "privacyAccepted" | "documents", string>>;

const requiredText = (message: string, minimum = 1, maximum = 3000) =>
  z.string().trim().min(minimum, message).max(maximum, "Мәтін рұқсат етілген ұзындықтан асып кетті.");
const optionalText = (maximum: number) => z.string().trim().max(maximum, "Мәтін рұқсат етілген ұзындықтан асып кетті.");

function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isAdult(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  return date <= cutoff && date >= new Date("1900-01-01T00:00:00.000Z");
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return trimmed;
}

export function constructFullName(surname: string, givenName: string, patronymic: string) {
  return [surname, givenName, patronymic].map((value) => value.trim()).filter(Boolean).join(" ");
}

export const membershipApplicationSchema = z.object({
  surname: requiredText("Тегіңізді енгізіңіз.", 1, 80),
  givenName: requiredText("Атыңызды енгізіңіз.", 1, 80),
  patronymic: optionalText(80),
  birthDate: z.string().min(1, "Туған күніңізді көрсетіңіз.").refine(validBirthDate, "Туған күнді дұрыс көрсетіңіз.").refine(isAdult, "Өтініш беруші кемінде 18 жаста болуы керек."),
  regionCode: requiredText("Өңірді таңдаңыз.", 2, 40),
  cityDistrict: requiredText("Қала немесе ауданды көрсетіңіз.", 2, 120),
  phone: z.string().trim().transform(normalizePhone).refine((value) => /^\+\d{10,15}$/.test(value), "Телефон нөмірін енгізіңіз."),
  workplace: optionalText(240),
  position: optionalText(160),
  educationLevelCode: z.enum(educationLevels.map(([code]) => code) as [string, ...string[]], { errorMap: () => ({ message: "Білім деңгейін таңдаңыз." }) }),
  educationInstitution: optionalText(240),
  educationProgram: optionalText(240),
  mathSpecialization: optionalText(500),
  achievements: optionalText(3000),
  joiningPurpose: requiredText("Бірлестікке қосылу мақсатын қысқаша жазыңыз.", 10, 500),
  source: z.enum(["web", "qr"]),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Мүшелік шарттарын қабылдаңыз." }) }),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Дербес деректерді өңдеуге келісім беріңіз." }) }),
});

export type ValidMembershipApplication = z.infer<typeof membershipApplicationSchema>;

export function zodFieldErrors(error: z.ZodError): MembershipFieldErrors {
  const errors: MembershipFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field as keyof MembershipFieldErrors]) {
      errors[field as keyof MembershipFieldErrors] = issue.message;
    }
  }
  return errors;
}

function text(input: Record<string, unknown>, field: MembershipDraftFieldName) {
  const value = input[field];
  return typeof value === "string" ? value.slice(0, 10_000) : "";
}

function dateValue(value: unknown) {
  const textValue = typeof value === "string" ? value.trim() : "";
  return validBirthDate(textValue) ? new Date(`${textValue}T00:00:00.000Z`) : null;
}

export function normalizeDraftInput(input: Record<string, unknown>) {
  const surname = text(input, "surname");
  const givenName = text(input, "givenName");
  const patronymic = text(input, "patronymic");
  const birthDate = dateValue(input.birthDate);
  return {
    surname,
    givenName,
    patronymic,
    fullName: constructFullName(surname, givenName, patronymic),
    birthDate,
    birthYear: birthDate?.getUTCFullYear() ?? null,
    regionCode: text(input, "regionCode"),
    cityDistrict: text(input, "cityDistrict"),
    phone: normalizePhone(text(input, "phone")),
    workplace: text(input, "workplace"),
    position: text(input, "position"),
    educationLevelCode: text(input, "educationLevelCode"),
    educationInstitution: text(input, "educationInstitution"),
    educationProgram: text(input, "educationProgram"),
    mathSpecialization: text(input, "mathSpecialization"),
    achievements: text(input, "achievements"),
    joiningPurpose: text(input, "joiningPurpose"),
    source: input.source === "qr" ? "qr" : "web",
    termsAccepted: input.termsAccepted === true || input.termsAccepted === "true" || input.termsAccepted === "on",
    privacyAccepted: input.privacyAccepted === true || input.privacyAccepted === "true" || input.privacyAccepted === "on",
  };
}

export function draftToValidationInput(draft: ReturnType<typeof normalizeDraftInput>) {
  return { ...draft, birthDate: draft.birthDate?.toISOString().slice(0, 10) ?? "" };
}

export const allowedApplicationDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const maximumApplicationDocumentBytes = 5 * 1024 * 1024;

export function hasValidApplicationDocumentSignature(type: string, bytes: ArrayBuffer) {
  const header = new Uint8Array(bytes.slice(0, 8));
  if (type === "application/pdf") return new TextDecoder().decode(header.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg") return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => header[index] === byte);
  return false;
}
