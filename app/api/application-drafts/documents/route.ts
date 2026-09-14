import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  allowedApplicationDocumentTypes,
  hasValidApplicationDocumentSignature,
  maximumApplicationDocumentBytes,
} from "@/lib/membership-application";
import { assertSameOrigin, sha256Hex } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function POST(request: Request) {
  const uploadedKeys: string[] = [];
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!user.emailVerifiedAt) return Response.json({ error: "email_unverified", message: "Электрондық поштаңызды растаңыз." }, { status: 403 });
    if (user.membershipStatus !== "registered_user") return Response.json({ error: "application_already_submitted" }, { status: 409 });
    await ensureDatabase();
    const database = getDb();
    const draft = await database.membershipApplicationDraft.findUnique({
      where: { userId: user.id },
      include: { documents: { where: { status: "active", archivedAt: null }, select: { id: true } } },
    });
    if (!draft || draft.personId !== user.profileId) return Response.json({ error: "draft_not_found" }, { status: 404 });
    if (draft.status !== "draft") return Response.json({ error: "draft_closed" }, { status: 409 });

    const form = await request.formData();
    const files = form.getAll("documents").filter((value): value is File => typeof value !== "string" && value.size > 0);
    if (files.length < 1) return Response.json({ errors: { documents: "Жүктейтін файлды таңдаңыз." } }, { status: 422 });
    if (draft.documents.length + files.length > 3) return Response.json({ errors: { documents: "Ең көбі 3 құжат тіркеуге болады." } }, { status: 422 });

    const prepared: Array<{ id: string; key: string; name: string; type: string; size: number; checksum: string }> = [];
    const storage = getPrivateObjectStorage();
    for (const file of files) {
      if (file.size > maximumApplicationDocumentBytes) {
        return Response.json({ errors: { documents: `${file.name}: файл көлемі 5 МБ-тан аспауы керек.` } }, { status: 422 });
      }
      if (!allowedApplicationDocumentTypes.has(file.type)) {
        return Response.json({ errors: { documents: `${file.name}: тек PDF, JPG немесе PNG файлын тіркеңіз.` } }, { status: 422 });
      }
      const bytes = await file.arrayBuffer();
      if (!hasValidApplicationDocumentSignature(file.type, bytes)) {
        return Response.json({ errors: { documents: `${file.name}: файл мазмұны оның түріне сәйкес емес.` } }, { status: 422 });
      }
      const id = crypto.randomUUID();
      const key = `drafts/${draft.id}/${id}`;
      await storage.put(key, bytes);
      uploadedKeys.push(key);
      prepared.push({ id, key, name: file.name.slice(0, 240), type: file.type, size: file.size, checksum: await sha256Hex(bytes) });
    }

    await database.uploadedDocument.createMany({ data: prepared.map((document) => ({
      id: document.id,
      ownerPersonId: user.profileId,
      draftId: draft.id,
      uploadedBy: user.id,
      objectKey: document.key,
      originalName: document.name,
      mimeType: document.type,
      sizeBytes: document.size,
      checksumSha256: document.checksum,
      visibility: "owner",
      status: "active",
    })) });
    uploadedKeys.length = 0;
    const documents = await database.uploadedDocument.findMany({
      where: { draftId: draft.id, status: "active", archivedAt: null },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ uploaded: true, documents });
  } catch {
    return Response.json({ error: "unexpected", message: "Құжатты сақтау мүмкін болмады." }, { status: 500 });
  } finally {
    if (uploadedKeys.length) {
      const storage = getPrivateObjectStorage();
      await Promise.all(uploadedKeys.map((key) => storage.delete(key)));
    }
  }
}
