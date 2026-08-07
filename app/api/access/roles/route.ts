import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageRoles } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const roleSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), userId: z.string(), roleId: z.string(), scopeId: z.string().optional().default("") }),
  z.object({ action: z.literal("revoke"), assignmentId: z.string() }),
]);

export async function POST(request: Request) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !canManageRoles(actor)) return new Response("Forbidden", { status: 403 });
  const parsed = roleSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL("/dashboard/access?error=validation", request.url), 303);
  await ensureDatabase();
  const database = getRawDb();
  const now = new Date().toISOString();
  if (parsed.data.action === "grant") {
    const role = await database.prepare("SELECT id, slug, access_level AS accessLevel FROM roles WHERE id = ?").bind(parsed.data.roleId).first<{ id: string; slug: string; accessLevel: string }>();
    const target = await database.prepare("SELECT id FROM users WHERE id = ? AND archived_at IS NULL").bind(parsed.data.userId).first<{ id: string }>();
    if (!role || !target) return new Response("Not found", { status: 404 });
    const scopeType = role.slug.startsWith("branch_") ? "branch" : role.slug.startsWith("department_") || role.slug === "vice_president_2" ? "department" : "global";
    const scopeId = scopeType === "global" ? null : parsed.data.scopeId || null;
    if (scopeType !== "global" && !scopeId) return Response.redirect(new URL("/dashboard/access?error=scope", request.url), 303);
    const assignmentId = crypto.randomUUID();
    await database.batch([
      database.prepare("INSERT INTO user_roles (id, user_id, role_id, scope_type, scope_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(assignmentId, parsed.data.userId, role.id, scopeType, scopeId, actor.id, now),
      database.prepare("INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id, new_value, reason, ip_address, session_id, created_at) VALUES (?, ?, 'role.granted', 'user_role', ?, ?, 'Әкімшілік қолжетімділік берілді', ?, ?, ?)")
        .bind(crypto.randomUUID(), actor.id, assignmentId, JSON.stringify({ userId: parsed.data.userId, role: role.slug, scopeType, scopeId }), clientIp(request), actor.sessionId, now),
    ]);
  } else {
    const assignment = await database.prepare(
      `SELECT ur.id, ur.user_id AS userId, r.slug FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.id = ? AND ur.revoked_at IS NULL`,
    ).bind(parsed.data.assignmentId).first<{ id: string; userId: string; slug: string }>();
    if (!assignment) return new Response("Not found", { status: 404 });
    if (assignment.userId === actor.id && new Set(["president", "vice_president_1", "super_admin"]).has(assignment.slug)) {
      return Response.redirect(new URL("/dashboard/access?error=self", request.url), 303);
    }
    await database.batch([
      database.prepare("UPDATE user_roles SET revoked_at = ? WHERE id = ?").bind(now, assignment.id),
      database.prepare("INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id, previous_value, reason, ip_address, session_id, created_at) VALUES (?, ?, 'role.revoked', 'user_role', ?, ?, 'Әкімшілік қолжетімділік қайтарылды', ?, ?, ?)")
        .bind(crypto.randomUUID(), actor.id, assignment.id, JSON.stringify(assignment), clientIp(request), actor.sessionId, now),
    ]);
  }
  return Response.redirect(new URL("/dashboard/access?success=updated", request.url), 303);
}
