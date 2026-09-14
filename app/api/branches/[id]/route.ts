import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const branchSchema = z.object({
  name: z.string().trim().min(4).max(180),
  status: z.enum(["active", "inactive", "archived"]),
  reason: z.string().trim().min(5).max(1000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !isFullAccess(actor)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = branchSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL("/dashboard/branches?error=validation", request.url), 303);
  await ensureDatabase();
  const database = getDb();
  const current = await database.branch.findFirst({ where: { id, archivedAt: null }, select: { name: true, status: true } });
  if (!current) return new Response("Not found", { status: 404 });
  const now = new Date();
  await database.$transaction([
    database.branch.update({ where: { id }, data: { name: parsed.data.name, status: parsed.data.status, updatedAt: now } }),
    database.auditLog.create({ data: {
      id: crypto.randomUUID(), actorUserId: actor.id, actionType: "branch.updated", targetEntity: "branch",
      targetEntityId: id, previousValue: JSON.stringify(current), newValue: JSON.stringify({ name: parsed.data.name, status: parsed.data.status }),
      reason: parsed.data.reason, ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
    } }),
  ]);
  return Response.redirect(new URL("/dashboard/branches?success=updated", request.url), 303);
}
