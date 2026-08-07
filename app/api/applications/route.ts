import { env } from "cloudflare:workers";
import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { checkRateLimit } from "@/db/queries";
import { getRawDb } from "@/db";
import { assertSameOrigin, clientIp, sha256Hex } from "@/lib/security";

const applicationSchema = z.object({
  fullName: z.string().trim().min(5).max(160),
  birthYear: z.coerce.number().int().min(1940).max(new Date().getFullYear() - 18),
  regionCode: z.string().trim().min(2).max(40),
  cityDistrict: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().toLowerCase().email().max(180),
  workplace: z.string().trim().min(2).max(240),
  position: z.string().trim().min(2).max(160),
  education: z.string().trim().min(2).max(500),
  professionalExperience: z.string().trim().min(2).max(2000),
  mathSpecialization: z.string().trim().min(2).max(500),
  achievements: z.string().trim().max(3000).optional().default(""),
  biography: z.string().trim().min(30).max(3000),
  source: z.enum(["web", "qr"]).default("web"),
});

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function hasValidSignature(type: string, bytes: ArrayBuffer) {
  const header = new Uint8Array(bytes.slice(0, 8));
  if (type === "application/pdf") return new TextDecoder().decode(header.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg") return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => header[index] === byte);
  return false;
}

export async function POST(request: Request) {
  const uploadedKeys: string[] = [];
  try {
    assertSameOrigin(request);
    const ipAddress = clientIp(request);
    if (!(await checkRateLimit(`application:${ipAddress}`, 3, 3600))) {
      return Response.redirect(new URL("/membership?error=rate", request.url), 303);
    }
    const form = await request.formData();
    if (String(form.get("termsAccepted") ?? "") !== "on") {
      return Response.redirect(new URL("/membership?error=terms", request.url), 303);
    }
    const parsed = applicationSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      return Response.redirect(new URL("/membership?error=validation", request.url), 303);
    }
    const files = form.getAll("documents").filter((value): value is File => typeof value !== "string" && value.size > 0);
    if (files.length < 1 || files.length > 3 || files.some((file) => file.size > 5 * 1024 * 1024 || !allowedTypes.has(file.type))) {
      return Response.redirect(new URL("/membership?error=document", request.url), 303);
    }

    await ensureDatabase();
    const database = getRawDb();
    const branch = await database.prepare("SELECT id FROM branches WHERE region_code = ? AND status = 'active' AND archived_at IS NULL").bind(parsed.data.regionCode).first<{ id: string }>();
    if (!branch) return Response.redirect(new URL("/membership?error=region", request.url), 303);
    const duplicate = await database.prepare("SELECT id FROM person_profiles WHERE email = ? AND archived_at IS NULL").bind(parsed.data.email).first<{ id: string }>();
    if (duplicate) return Response.redirect(new URL("/membership?error=duplicate", request.url), 303);

    const personId = crypto.randomUUID();
    const applicationId = crypto.randomUUID();
    const now = new Date().toISOString();
    const storage = (env as unknown as { PRIVATE_DOCUMENTS?: R2Bucket }).PRIVATE_DOCUMENTS;
    if (!storage) throw new Error("Private document storage is unavailable");
    const documentRows: Array<{ id: string; key: string; name: string; type: string; size: number; checksum: string }> = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      if (!hasValidSignature(file.type, bytes)) {
        throw new Error("Invalid document signature");
      }
      const id = crypto.randomUUID();
      const key = `applications/${applicationId}/${id}`;
      await storage.put(key, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
      uploadedKeys.push(key);
      documentRows.push({ id, key, name: file.name.slice(0, 240), type: file.type, size: file.size, checksum: await sha256Hex(bytes) });
    }

    const statements = [
      database.prepare(
        `INSERT INTO person_profiles (id, full_name, birth_year, region_code, city_district, phone, email,
          workplace, position, education, professional_experience, math_specialization, achievements,
          biography, membership_status, branch_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applicant', ?, ?, ?)`,
      ).bind(personId, parsed.data.fullName, parsed.data.birthYear, parsed.data.regionCode, parsed.data.cityDistrict,
        parsed.data.phone, parsed.data.email, parsed.data.workplace, parsed.data.position, parsed.data.education,
        parsed.data.professionalExperience, parsed.data.mathSpecialization, parsed.data.achievements,
        parsed.data.biography, branch.id, now, now),
      database.prepare(
        `INSERT INTO membership_applications (id, person_id, branch_id, status, submitted_at, terms_version,
          terms_accepted_at, source) VALUES (?, ?, ?, 'awaiting_review', ?, '2026.1', ?, ?)`,
      ).bind(applicationId, personId, branch.id, now, now, parsed.data.source),
      database.prepare(
        `INSERT INTO membership_status_history (id, person_id, application_id, previous_status, new_status,
          reason, visibility, created_at) VALUES (?, ?, ?, 'registered_user', 'applicant',
          'Өтініш қабылданды', 'member', ?)`,
      ).bind(crypto.randomUUID(), personId, applicationId, now),
      database.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id,
          previous_value, new_value, reason, ip_address, created_at)
         VALUES (?, NULL, 'application.submitted', 'membership_application', ?, NULL, ?,
          'Қоғамдық нысан арқылы жіберілді', ?, ?)`,
      ).bind(crypto.randomUUID(), applicationId, JSON.stringify({ status: "awaiting_review", branchId: branch.id }), ipAddress, now),
      ...documentRows.map((document) => database.prepare(
        `INSERT INTO uploaded_documents (id, owner_person_id, application_id, object_key, original_name,
          mime_type, size_bytes, checksum_sha256, visibility, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reviewers', 'active', ?, ?)`,
      ).bind(document.id, personId, applicationId, document.key, document.name, document.type, document.size, document.checksum, now, now)),
    ];
    await database.batch(statements);
    return Response.redirect(new URL(`/membership/success?id=${encodeURIComponent(applicationId)}`, request.url), 303);
  } catch {
    const storage = (env as unknown as { PRIVATE_DOCUMENTS?: R2Bucket }).PRIVATE_DOCUMENTS;
    if (storage) await Promise.all(uploadedKeys.map((key) => storage.delete(key)));
    return Response.redirect(new URL("/membership?error=unexpected", request.url), 303);
  }
}
