import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { allowedApplicationDocumentTypes, hasValidApplicationDocumentSignature, maximumApplicationDocumentBytes } from "@/lib/membership-application";
import { assertSameOrigin, clientIp, sha256Hex } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

function ownDocuments(profileId: string) {
  return getDb().uploadedDocument.findMany({
    where: { ownerPersonId: profileId, status: { in: ["active", "removal_requested"] }, archivedAt: null },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, applicationId: true, draftId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureDatabase();
  return Response.json({ documents: await ownDocuments(user.profileId) });
}

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    await ensureDatabase();
    const form = await request.formData();
    const value = form.get("document");
    if (typeof value === "string" || !value || value.size < 1) return Response.json({ error: "validation", message: "Жүктейтін файлды таңдаңыз." }, { status: 422 });
    if (value.size > maximumApplicationDocumentBytes) return Response.json({ error: "validation", message: "Файл көлемі 5 МБ-тан аспауы керек." }, { status: 422 });
    if (!allowedApplicationDocumentTypes.has(value.type)) return Response.json({ error: "validation", message: "Тек PDF, JPG немесе PNG файлын жүктеңіз." }, { status: 422 });
    const bytes = await value.arrayBuffer();
    if (!hasValidApplicationDocumentSignature(value.type, bytes)) return Response.json({ error: "validation", message: "Файл мазмұны оның түріне сәйкес емес." }, { status: 422 });

    const id = crypto.randomUUID();
    uploadedKey = `profiles/${user.profileId}/${id}`;
    await getPrivateObjectStorage().put(uploadedKey, bytes);
    const now = new Date();
    await getDb().$transaction([
      getDb().uploadedDocument.create({ data: {
        id, ownerPersonId: user.profileId, uploadedBy: user.id, objectKey: uploadedKey,
        originalName: value.name.slice(0, 240), mimeType: value.type, sizeBytes: value.size,
        checksumSha256: await sha256Hex(bytes), visibility: "owner", status: "active", createdAt: now, updatedAt: now,
      } }),
      getDb().auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: "profile.document_uploaded",
        targetEntity: "uploaded_document", targetEntityId: id,
        newValue: JSON.stringify({ ownerPersonId: user.profileId, mimeType: value.type, sizeBytes: value.size }),
        reason: "Пайдаланушы өз тұрақты профиліне қосымша құжат жүктеді", ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } }),
    ]);
    uploadedKey = null;
    return Response.json({ uploaded: true, documents: await ownDocuments(user.profileId) });
  } catch {
    return Response.json({ error: "unexpected", message: "Құжатты жүктеу мүмкін болмады." }, { status: 500 });
  } finally {
    if (uploadedKey) await getPrivateObjectStorage().delete(uploadedKey);
  }
}
