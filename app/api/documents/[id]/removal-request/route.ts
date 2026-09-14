import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/security";

const schema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const input = request.headers.get("content-type")?.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
    const parsed = schema.safeParse(input);
    if (!parsed.success) return Response.json({ error: "validation", message: "Жою себебін кемінде 5 таңбамен жазыңыз." }, { status: 422 });
    await ensureDatabase();
    const database = getDb();
    const { id } = await context.params;
    const document = await database.uploadedDocument.findFirst({
      where: { id, ownerPersonId: user.profileId, applicationId: { not: null }, status: "active", archivedAt: null },
      select: { id: true, originalName: true, applicationId: true },
    });
    if (!document) return Response.json({ error: "not_found" }, { status: 404 });
    const now = new Date();
    await database.$transaction([
      database.uploadedDocument.update({ where: { id: document.id }, data: { status: "removal_requested", updatedAt: now } }),
      database.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: "document.removal_requested",
        targetEntity: "uploaded_document", targetEntityId: document.id,
        previousValue: JSON.stringify({ status: "active", originalName: document.originalName, applicationId: document.applicationId }),
        newValue: JSON.stringify({ status: "removal_requested" }),
        reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } }),
    ]);
    return Response.json({ requested: true });
  } catch {
    return Response.json({ error: "unexpected", message: "Жою сұрауын жіберу мүмкін болмады." }, { status: 500 });
  }
}
