import { env } from "cloudflare:workers";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch } from "@/lib/authorization";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  await ensureDatabase();
  const { id } = await context.params;
  const document = await getRawDb().prepare(
    `SELECT d.object_key AS objectKey, d.original_name AS originalName, d.mime_type AS mimeType,
            d.owner_person_id AS ownerPersonId, a.branch_id AS branchId
     FROM uploaded_documents d LEFT JOIN membership_applications a ON a.id = d.application_id
     WHERE d.id = ? AND d.status = 'active' AND d.archived_at IS NULL`,
  ).bind(id).first<{ objectKey: string; originalName: string; mimeType: string; ownerPersonId: string; branchId: string | null }>();
  if (!document || (document.ownerPersonId !== user.profileId && (!document.branchId || !canAccessBranch(user, document.branchId)))) {
    return new Response("Forbidden", { status: 403 });
  }
  const storage = (env as unknown as { PRIVATE_DOCUMENTS?: R2Bucket }).PRIVATE_DOCUMENTS;
  const object = storage ? await storage.get(document.objectKey) : null;
  if (!object) return new Response("Not found", { status: 404 });
  const safeName = document.originalName.replace(/[\r\n"]/g, "_");
  return new Response(object.body, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
