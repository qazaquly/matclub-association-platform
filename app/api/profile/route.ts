import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/security";

const profileSchema = z.object({
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().toLowerCase().email().max(180),
  workplace: z.string().trim().max(240),
  position: z.string().trim().max(160),
  professionalExperience: z.string().trim().max(2000),
  mathSpecialization: z.string().trim().max(500),
  achievements: z.string().trim().max(3000),
  biography: z.string().trim().max(3000),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (!user) return new Response("Unauthorized", { status: 401 });
    const parsed = profileSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(new URL("/dashboard/profile?error=validation", request.url), 303);
    await ensureDatabase();
    const database = getRawDb();
    const current = await database.prepare(
      `SELECT phone, email, workplace, position, professional_experience AS professionalExperience,
              math_specialization AS mathSpecialization, achievements, biography
       FROM person_profiles WHERE id = ? AND archived_at IS NULL`,
    ).bind(user.profileId).first<Record<string, string | null>>();
    if (!current) return new Response("Not found", { status: 404 });
    const duplicate = await database.prepare("SELECT id FROM person_profiles WHERE email = ? AND id <> ? AND archived_at IS NULL").bind(parsed.data.email, user.profileId).first<{ id: string }>();
    if (duplicate) return Response.redirect(new URL("/dashboard/profile?error=email", request.url), 303);
    const changed = Object.fromEntries(Object.entries(parsed.data).filter(([key, value]) => value !== (current[key] ?? "")));
    if (Object.keys(changed).length === 0) return Response.redirect(new URL("/dashboard/profile?success=nochange", request.url), 303);
    const now = new Date().toISOString();
    await database.batch([
      database.prepare(
        `UPDATE person_profiles SET phone = ?, email = ?, workplace = ?, position = ?,
          professional_experience = ?, math_specialization = ?, achievements = ?, biography = ?,
          updated_at = ? WHERE id = ?`,
      ).bind(parsed.data.phone, parsed.data.email, parsed.data.workplace, parsed.data.position,
        parsed.data.professionalExperience, parsed.data.mathSpecialization, parsed.data.achievements,
        parsed.data.biography, now, user.profileId),
      database.prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?").bind(parsed.data.email, now, user.id),
      database.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id,
          previous_value, new_value, reason, ip_address, session_id, created_at)
         VALUES (?, ?, 'profile.self_updated', 'person_profile', ?, ?, ?,
          'Мүше өңдей алатын өрістер жаңартылды', ?, ?, ?)`,
      ).bind(crypto.randomUUID(), user.id, user.profileId,
        JSON.stringify(Object.fromEntries(Object.keys(changed).map((key) => [key, current[key]]))),
        JSON.stringify(changed), clientIp(request), user.sessionId, now),
    ]);
    return Response.redirect(new URL("/dashboard/profile?success=updated", request.url), 303);
  } catch {
    return Response.redirect(new URL("/dashboard/profile?error=unexpected", request.url), 303);
  }
}
