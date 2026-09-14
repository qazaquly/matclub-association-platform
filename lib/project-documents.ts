import { projectDocumentCategories } from "@/lib/projects";

export const maximumProjectDocumentBytes = 10 * 1024 * 1024;

export const allowedProjectDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function validProjectDocumentSignature(mimeType: string, body: ArrayBuffer) {
  const bytes = new Uint8Array(body);
  if (mimeType === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (mimeType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType.startsWith("application/vnd.openxmlformats-officedocument.")) return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return false;
}

export function parseProjectDocumentCategory(value: FormDataEntryValue | null) {
  const category = String(value ?? "OTHER");
  if (!(projectDocumentCategories as readonly string[]).includes(category)) throw new Error("INVALID_PROJECT_DOCUMENT:category");
  return category;
}
