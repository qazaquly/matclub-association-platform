export const institutionalDocumentTypes = ["ORDER", "PROTOCOL", "DECISION", "REGULATION", "LETTER", "REPORT", "OTHER"] as const;
export const institutionalDocumentScopes = ["NATIONAL", "BRANCH"] as const;
export const institutionalDocumentAccessLevels = ["LEADERSHIP", "RESPONSIBLE", "MEMBERS"] as const;

export const maximumInstitutionalDocumentBytes = 10 * 1024 * 1024;

export const allowedInstitutionalDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function value(form: FormData, key: string, maxLength: number, required = false) {
  const result = String(form.get(key) ?? "").trim();
  if ((required && !result) || result.length > maxLength) throw new Error(`INVALID_INSTITUTIONAL_DOCUMENT:${key}`);
  return result || null;
}

function dateValue(form: FormData, key: string) {
  const raw = value(form, key, 20, true)!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`INVALID_INSTITUTIONAL_DOCUMENT:${key}`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_INSTITUTIONAL_DOCUMENT:${key}`);
  return date;
}

export function parseInstitutionalDocumentForm(form: FormData) {
  const documentType = value(form, "documentType", 40, true)!;
  const scopeType = value(form, "scopeType", 20, true)!;
  const accessLevel = value(form, "accessLevel", 20, true)!;
  if (!(institutionalDocumentTypes as readonly string[]).includes(documentType)) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:documentType");
  if (!(institutionalDocumentScopes as readonly string[]).includes(scopeType)) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:scopeType");
  if (!(institutionalDocumentAccessLevels as readonly string[]).includes(accessLevel)) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:accessLevel");
  return {
    title: value(form, "title", 240, true)!,
    documentNumber: value(form, "documentNumber", 120, true)!,
    documentDate: dateValue(form, "documentDate"),
    documentType,
    scopeType,
    branchId: scopeType === "BRANCH" ? value(form, "branchId", 120, true) : null,
    responsibleDepartmentId: value(form, "responsibleDepartmentId", 120),
    accessLevel,
    summary: value(form, "summary", 5_000),
  };
}

export function parseInstitutionalDocumentUpload(form: FormData) {
  const file = form.get("document");
  if (!file || typeof file === "string" || file.size < 1 || file.size > maximumInstitutionalDocumentBytes || !allowedInstitutionalDocumentTypes.has(file.type)) {
    throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:file");
  }
  return { file, changeNote: value(form, "changeNote", 1_000) };
}

export function validInstitutionalDocumentSignature(mimeType: string, body: ArrayBuffer) {
  const bytes = new Uint8Array(body);
  if (mimeType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mimeType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType.startsWith("application/vnd.openxmlformats-officedocument.")) return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return false;
}

export function institutionalDocumentTypeLabel(type: string) {
  return ({ ORDER: "Бұйрық", PROTOCOL: "Хаттама", DECISION: "Шешім", REGULATION: "Ереже", LETTER: "Қызметтік хат", REPORT: "Есеп", OTHER: "Басқа" } as Record<string, string>)[type] ?? type;
}

export function institutionalDocumentAccessLabel(level: string) {
  return ({ LEADERSHIP: "Тек Президент пен II вице-президент", RESPONSIBLE: "Жауапты құрылым", MEMBERS: "Бірлестік мүшелері" } as Record<string, string>)[level] ?? level;
}

export function institutionalDocumentScopeLabel(scope: string) {
  return scope === "BRANCH" ? "Филиалдық" : "Республикалық";
}
