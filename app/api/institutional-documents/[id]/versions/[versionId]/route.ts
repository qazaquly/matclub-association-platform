import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessInstitutionalDocument } from "@/lib/authorization";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const actor = await authenticateRequest(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { id, versionId } = await params;
  const version = await getDb().institutionalDocumentVersion.findFirst({ where: { id: versionId, documentId: id }, include: { document: true } });
  if (!version || !canAccessInstitutionalDocument(actor, version.document)) return new Response("Forbidden", { status: 403 });
  const object = await getPrivateObjectStorage().get(version.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": version.mimeType,
    "Content-Disposition": `attachment; filename="${version.originalName.replace(/[\r\n"]/g, "_")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
