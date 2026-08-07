import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
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
  const database = getRawDb();
  const current = await database.prepare("SELECT name, status FROM branches WHERE id = ? AND archived_at IS NULL").bind(id).first<{ name: string; status: string }>();
  if (!current) return new Response("Not found", { status: 404 });
  const now = new Date().toISOString();
  await database.batch([
    database.prepare("UPDATE branches SET name = ?, status = ?, updated_at = ? WHERE id = ?").bind(parsed.data.name, parsed.data.status, now, id),
    database.prepare("INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id, previous_value, new_value, reason, ip_address, session_id, created_at) VALUES (?, ?, 'branch.updated', 'branch', ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), actor.id, id, JSON.stringify(current), JSON.stringify({ name: parsed.data.name, status: parsed.data.status }), parsed.data.reason, clientIp(request), actor.sessionId, now),
  ]);
  return Response.redirect(new URL("/dashboard/branches?success=updated", request.url), 303);
}
