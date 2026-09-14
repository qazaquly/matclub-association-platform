import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/db";
import { getPublicObjectStorage } from "@/lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxBytes = 8 * 1024 * 1024;

function hasValidSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (mimeType === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (mimeType === "image/avif") {
    if (bytes.length < 12 || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp") return false;
    const brand = new TextDecoder().decode(bytes.slice(8, 12));
    return brand === "avif" || brand === "avis";
  }
  return false;
}

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-120);
  return cleaned || "image";
}

export async function createPublicMedia(file: File | null, uploadedBy: string) {
  if (!file || file.size === 0) return null;
  if (!allowedTypes.has(file.type) || file.size > maxBytes) throw new Error("INVALID_CONTENT:image");
  const body = await file.arrayBuffer();
  if (!hasValidSignature(new Uint8Array(body), file.type)) throw new Error("INVALID_CONTENT:image_signature");
  const checksum = [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = crypto.randomUUID();
  const objectKey = `public-media/${id}/${safeFileName(file.name)}`;
  const storage = getPublicObjectStorage();
  await storage.put(objectKey, body);
  try {
    return await getDb().publicMedia.create({ data: {
      id,
      objectKey,
      originalName: safeFileName(file.name),
      mimeType: file.type,
      sizeBytes: file.size,
      checksumSha256: checksum,
      uploadedBy,
    } });
  } catch (error) {
    await storage.delete(objectKey);
    throw error;
  }
}

export async function discardPublicMedia(id: string) {
  const database = getDb();
  const media = await database.publicMedia.findUnique({ where: { id } });
  if (!media) return;
  await database.publicMedia.delete({ where: { id } });
  await getPublicObjectStorage().delete(media.objectKey);
}

export async function archivePublicMedia(transaction: Prisma.TransactionClient, id: string | null | undefined) {
  if (!id) return;
  await transaction.publicMedia.updateMany({
    where: {
      id,
      status: "active",
      newsCovers: { none: { status: { not: "ARCHIVED" } } },
      publicationCovers: { none: { status: { not: "ARCHIVED" } } },
      projectCovers: { none: { status: { not: "ARCHIVED" } } },
      eventCovers: { none: { status: { not: "ARCHIVED" } } },
      partnerLogos: { none: {} },
    },
    data: { status: "archived", archivedAt: new Date(), purgeStartedAt: null },
  });
}

export async function activatePublicMedia(transaction: Prisma.TransactionClient, id: string | null | undefined) {
  if (!id) return;
  await transaction.publicMedia.updateMany({
    where: { id, status: "archived" },
    data: { status: "active", archivedAt: null, purgeStartedAt: null },
  });
}
