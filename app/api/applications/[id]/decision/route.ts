import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch, canReviewApplications } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const decisionSchema = z.object({
  decision: z.enum(["rejected", "reserve", "approved"]),
  reason: z.string().trim().min(5).max(1500),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user || !canReviewApplications(user)) return new Response("Forbidden", { status: 403 });
    const { id } = await context.params;
    const form = await request.formData();
    const parsed = decisionSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) return Response.redirect(new URL(`/dashboard/applications/${id}?error=validation`, request.url), 303);

    await ensureDatabase();
    const database = getRawDb();
    const application = await database.prepare(
      `SELECT a.id, a.person_id AS personId, a.branch_id AS branchId, a.status,
              p.membership_status AS membershipStatus, p.user_id AS profileUserId
       FROM membership_applications a JOIN person_profiles p ON p.id = a.person_id
       WHERE a.id = ? AND a.archived_at IS NULL`,
    ).bind(id).first<{ id: string; personId: string; branchId: string; status: string; membershipStatus: string; profileUserId: string | null }>();
    if (!application || !canAccessBranch(user, application.branchId)) return new Response("Forbidden", { status: 403 });
    if (!new Set(["awaiting_review", "reserve"]).has(application.status)) {
      return Response.redirect(new URL(`/dashboard/applications/${id}?error=final`, request.url), 303);
    }

    const membershipStatus = parsed.data.decision === "approved" ? "member" : parsed.data.decision;
    const now = new Date().toISOString();
    const statements = [
      database.prepare("UPDATE membership_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, decision_reason = ? WHERE id = ?")
        .bind(parsed.data.decision, now, user.id, parsed.data.reason, id),
      database.prepare(
        `UPDATE person_profiles SET membership_status = ?, membership_started_at = CASE WHEN ? = 'member' THEN COALESCE(membership_started_at, ?) ELSE membership_started_at END, updated_at = ? WHERE id = ?`,
      ).bind(membershipStatus, membershipStatus, now, now, application.personId),
      database.prepare(
        `INSERT INTO membership_status_history (id, person_id, application_id, previous_status, new_status,
          reason, visibility, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), application.personId, id, application.membershipStatus, membershipStatus,
        parsed.data.reason, membershipStatus === "member" ? "member" : "internal", user.id, now),
      database.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id,
          previous_value, new_value, reason, ip_address, session_id, created_at)
         VALUES (?, ?, ?, 'membership_application', ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), user.id, `application.${parsed.data.decision}`, id,
        JSON.stringify({ applicationStatus: application.status, membershipStatus: application.membershipStatus }),
        JSON.stringify({ applicationStatus: parsed.data.decision, membershipStatus }), parsed.data.reason,
        clientIp(request), user.sessionId, now),
    ];
    if (membershipStatus === "member" && application.profileUserId) {
      statements.push(database.prepare(
        `INSERT INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
         SELECT ?, ?, 'role-member', 'global', ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = 'role-member' AND revoked_at IS NULL)`,
      ).bind(crypto.randomUUID(), application.profileUserId, user.id, now, application.profileUserId));
    }
    await database.batch(statements);
    return Response.redirect(new URL(`/dashboard/applications/${id}?success=decision`, request.url), 303);
  } catch {
    return new Response("Unable to record the decision", { status: 400 });
  }
}
