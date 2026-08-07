import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const memberSchema = z.object({
  membershipStatus: z.enum(["registered_user", "applicant", "reserve", "member", "rejected", "suspended", "former_member"]),
  branchId: z.string().trim().min(2),
  reason: z.string().trim().min(5).max(1500),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const user = await authenticateRequest(request);
  if (!user || !isFullAccess(user)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = memberSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL(`/dashboard/members?error=validation`, request.url), 303);
  await ensureDatabase();
  const database = getRawDb();
  const current = await database.prepare("SELECT membership_status AS membershipStatus, branch_id AS branchId FROM person_profiles WHERE id = ? AND archived_at IS NULL").bind(id).first<{ membershipStatus: string; branchId: string | null }>();
  const branch = await database.prepare("SELECT id FROM branches WHERE id = ? AND archived_at IS NULL").bind(parsed.data.branchId).first<{ id: string }>();
  if (!current || !branch) return new Response("Not found", { status: 404 });
  const now = new Date().toISOString();
  const statements = [
    database.prepare(
      `UPDATE person_profiles SET membership_status = ?, branch_id = ?,
        membership_started_at = CASE WHEN ? = 'member' THEN COALESCE(membership_started_at, ?) ELSE membership_started_at END,
        updated_at = ? WHERE id = ?`,
    ).bind(parsed.data.membershipStatus, parsed.data.branchId, parsed.data.membershipStatus, now, now, id),
    database.prepare(
      `INSERT INTO membership_status_history (id, person_id, previous_status, new_status, reason,
        visibility, changed_by, created_at) VALUES (?, ?, ?, ?, ?, 'internal', ?, ?)`,
    ).bind(crypto.randomUUID(), id, current.membershipStatus, parsed.data.membershipStatus, parsed.data.reason, user.id, now),
    database.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id,
        previous_value, new_value, reason, ip_address, session_id, created_at)
       VALUES (?, ?, 'member.administrative_update', 'person_profile', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), user.id, id,
      JSON.stringify({ membershipStatus: current.membershipStatus, branchId: current.branchId }),
      JSON.stringify({ membershipStatus: parsed.data.membershipStatus, branchId: parsed.data.branchId }),
      parsed.data.reason, clientIp(request), user.sessionId, now),
  ];
  await database.batch(statements);
  return Response.redirect(new URL("/dashboard/members?success=updated", request.url), 303);
}
