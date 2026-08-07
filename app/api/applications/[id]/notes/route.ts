import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessBranch, canReviewApplications, isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const noteSchema = z.object({
  note: z.string().trim().min(3).max(2000),
  visibility: z.enum(["branch", "central"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const user = await authenticateRequest(request);
  if (!user || !canReviewApplications(user)) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const parsed = noteSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success || (parsed.data.visibility === "central" && !isFullAccess(user))) {
    return Response.redirect(new URL(`/dashboard/applications/${id}?error=note`, request.url), 303);
  }
  await ensureDatabase();
  const database = getRawDb();
  const application = await database.prepare("SELECT person_id AS personId, branch_id AS branchId FROM membership_applications WHERE id = ? AND archived_at IS NULL").bind(id).first<{ personId: string; branchId: string }>();
  if (!application || !canAccessBranch(user, application.branchId)) return new Response("Forbidden", { status: 403 });
  const now = new Date().toISOString();
  await database.batch([
    database.prepare("INSERT INTO internal_notes (id, person_id, application_id, branch_id, author_user_id, note, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), application.personId, id, application.branchId, user.id, parsed.data.note, parsed.data.visibility, now),
    database.prepare("INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id, new_value, ip_address, session_id, created_at) VALUES (?, ?, 'internal_note.created', 'membership_application', ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.id, id, JSON.stringify({ visibility: parsed.data.visibility }), clientIp(request), user.sessionId, now),
  ]);
  return Response.redirect(new URL(`/dashboard/applications/${id}?success=note`, request.url), 303);
}
