import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    await ensureDatabase();
    const { id } = await context.params;
    const document = await getDb().uploadedDocument.findFirst({
      where: { id, ownerPersonId: user.profileId, draft: { userId: user.id, status: "draft" }, status: "active", archivedAt: null },
      select: { id: true, objectKey: true },
    });
    if (!document) return Response.json({ error: "not_found" }, { status: 404 });
    await getPrivateObjectStorage().delete(document.objectKey);
    await getDb().uploadedDocument.delete({ where: { id: document.id } });
    return Response.json({ removed: true });
  } catch {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
