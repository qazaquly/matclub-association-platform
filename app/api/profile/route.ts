import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { constructFullName, educationLevels, normalizePhone } from "@/lib/membership-application";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { logRuntimeError } from "@/lib/runtime-error";

const educationCodes = educationLevels.map(([code]) => code);
const profileSchema = z.object({
  surname: z.string().trim().max(80),
  givenName: z.string().trim().min(1).max(80),
  patronymic: z.string().trim().max(80),
  phone: z.string().trim().transform(normalizePhone).refine((value) => /^\+\d{10,15}$/.test(value)),
  workplace: z.string().trim().max(240),
  position: z.string().trim().max(160),
  educationLevelCode: z.string().trim().refine((value) => !value || educationCodes.includes(value as typeof educationCodes[number])),
  educationInstitution: z.string().trim().max(240),
  educationProgram: z.string().trim().max(240),
  mathSpecialization: z.string().trim().max(500),
  achievements: z.string().trim().max(3000),
});

function normalizeForComparison(value: string | null) {
  return (value ?? "").replace(/\r\n?/g, "\n");
}

export async function POST(request: Request) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    stage = "authentication";
    const user = await authenticateRequest(request);
    if (!user) return new Response("Unauthorized", { status: 401 });
    stage = "validation";
    const parsed = profileSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) {
      const nameError = parsed.error.issues.some((issue) => issue.path[0] === "givenName");
      return Response.redirect(new URL(`/dashboard/profile?error=${nameError ? "fullName" : "validation"}`, request.url), 303);
    }
    stage = "database";
    await ensureDatabase();
    const database = getDb();
    stage = "profile_lookup";
    const current = await database.personProfile.findFirst({
      where: { id: user.profileId, archivedAt: null },
      select: { fullName: true, surname: true, givenName: true, patronymic: true, phone: true, workplace: true, position: true, educationLevelCode: true, educationInstitution: true, educationProgram: true, mathSpecialization: true, achievements: true },
    });
    if (!current) return new Response("Not found", { status: 404 });
    const submitted = {
      ...parsed.data,
      patronymic: parsed.data.patronymic || null,
      workplace: parsed.data.workplace || null,
      position: parsed.data.position || null,
      educationLevelCode: parsed.data.educationLevelCode || null,
      educationInstitution: parsed.data.educationInstitution || null,
      educationProgram: parsed.data.educationProgram || null,
      mathSpecialization: parsed.data.mathSpecialization || null,
      achievements: parsed.data.achievements || null,
      fullName: constructFullName(parsed.data.surname, parsed.data.givenName, parsed.data.patronymic),
    };
    const changed = Object.fromEntries(Object.entries(submitted).filter(([key, value]) => normalizeForComparison(value) !== normalizeForComparison(current[key as keyof typeof current])));
    if (Object.keys(changed).length === 0) return Response.redirect(new URL("/dashboard/profile?success=nochange", request.url), 303);
    const now = new Date();
    stage = "profile_transaction";
    await database.$transaction([
      database.personProfile.update({ where: { id: user.profileId }, data: { ...changed, updatedAt: now } }),
      database.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: user.id, actionType: "profile.self_updated",
        targetEntity: "person_profile", targetEntityId: user.profileId,
        previousValue: JSON.stringify(Object.fromEntries(Object.keys(changed).map((key) => [key, current[key as keyof typeof current]]))),
        newValue: JSON.stringify(changed), reason: "Мүше өңдей алатын профиль өрістері жаңартылды",
        ipAddress: clientIp(request), sessionId: user.sessionId, createdAt: now,
      } }),
    ]);
    return Response.redirect(new URL("/dashboard/profile?success=updated", request.url), 303);
  } catch (error) {
    logRuntimeError("profile.save.runtime_error", stage, error);
    return Response.redirect(new URL("/dashboard/profile?error=unexpected", request.url), 303);
  }
}
