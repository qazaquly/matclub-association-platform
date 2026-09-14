import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch, hasPermission } from "@/lib/authorization";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  await ensureDatabase();
  const { id } = await context.params;
  const document = await getDb().uploadedDocument.findFirst({
    where: { id, status: { in: ["active", "removal_requested"] }, archivedAt: null },
    include: { application: { select: { branchId: true } }, owner: { select: { branchId: true } } },
  });
  const branchId = document?.application?.branchId ?? document?.owner.branchId ?? null;
  const staffAllowed = Boolean(branchId && hasPermission(user, "documents.branch.read") && canAccessBranch(user, branchId));
  if (!document || (document.ownerPersonId !== user.profileId && !staffAllowed)) {
    return new Response("Forbidden", { status: 403 });
  }
  const object = await getPrivateObjectStorage().get(document.objectKey);
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
