import { ensureDatabase } from "@/db/bootstrap";
import { checkRateLimit } from "@/db/queries";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  draftToValidationInput,
  membershipApplicationSchema,
  normalizeDraftInput,
  zodFieldErrors,
} from "@/lib/membership-application";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { logRuntimeError } from "@/lib/runtime-error";

function jsonRequest(request: Request) {
  return request.headers.get("accept")?.includes("application/json") || request.headers.get("content-type")?.includes("application/json");
}

function errorResponse(request: Request, body: Record<string, unknown>, status: number, fallback: string) {
  return jsonRequest(request)
    ? Response.json(body, { status })
    : Response.redirect(new URL(`/membership?error=${fallback}`, request.url), 303);
}

function successResponse(request: Request, applicationId: string) {
  const url = `/membership/success?id=${encodeURIComponent(applicationId)}`;
  return jsonRequest(request) ? Response.json({ submitted: true, applicationId, url }) : Response.redirect(new URL(url, request.url), 303);
}

async function requestInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) return await request.json() as Record<string, unknown>;
  return Object.fromEntries((await request.formData()).entries());
}

export async function POST(request: Request) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    stage = "authentication";
    const user = await authenticateRequest(request);
    if (!user) return errorResponse(request, { error: "unauthorized", message: "Алдымен draft тіркелгісін сақтаңыз немесе жүйеге кіріңіз." }, 401, "account");
    if (!user.emailVerifiedAt) return errorResponse(request, { error: "email_unverified", message: "Электрондық поштаңызды растаңыз." }, 403, "email");
    stage = "database";
    await ensureDatabase();
    const database = getDb();
    stage = "draft_input";
    const input = normalizeDraftInput(await requestInput(request));
    stage = "draft_lookup";
    let draft = await database.membershipApplicationDraft.findUnique({
      where: { userId: user.id },
      include: { documents: { where: { status: "active", archivedAt: null }, select: { id: true } } },
    });
    if (!draft || draft.personId !== user.profileId) return errorResponse(request, { error: "draft_not_found" }, 404, "unexpected");
    if (draft.submittedApplicationId) return successResponse(request, draft.submittedApplicationId);
    if (user.membershipStatus !== "registered_user") {
      const existing = await database.membershipApplication.findFirst({
        where: { personId: user.profileId, archivedAt: null },
        orderBy: { submittedAt: "desc" },
        select: { id: true },
      });
      return existing ? successResponse(request, existing.id) : errorResponse(request, { error: "application_already_submitted" }, 409, "duplicate");
    }

    if (draft.status === "draft") {
      await database.membershipApplicationDraft.updateMany({
        where: { id: draft.id, status: "draft", submittedApplicationId: null },
        data: input,
      });
      draft = await database.membershipApplicationDraft.findUniqueOrThrow({
        where: { id: draft.id },
        include: { documents: { where: { status: "active", archivedAt: null }, select: { id: true } } },
      });
    }
    if (draft.submittedApplicationId) return successResponse(request, draft.submittedApplicationId);
    if (draft.status !== "draft") {
      return errorResponse(request, { error: "submission_in_progress", message: "Өтініш жіберіліп жатыр. Қайталап баспаңыз." }, 409, "unexpected");
    }

    stage = "validation";
    const parsed = membershipApplicationSchema.safeParse(draftToValidationInput(input));
    const errors = parsed.success ? {} : zodFieldErrors(parsed.error);
    if (draft.documents.length > 3) errors.documents = "Ең көбі 3 құжат тіркеуге болады.";
    if (Object.keys(errors).length) return errorResponse(request, { error: "validation", errors }, 422, "validation");
    if (!parsed.success) return errorResponse(request, { error: "validation", errors }, 422, "validation");

    stage = "branch_lookup";
    const branch = await database.branch.findFirst({
      where: { regionCode: parsed.data.regionCode, status: "active", archivedAt: null },
      select: { id: true },
    });
    if (!branch) return errorResponse(request, { error: "validation", errors: { regionCode: "Таңдалған өңірде белсенді филиал табылмады." } }, 422, "region");

    stage = "rate_limit";
    const ipAddress = clientIp(request);
    const [ipAllowed, userAllowed] = await Promise.all([
      checkRateLimit(`application:valid-submit:ip:${ipAddress}`, 10, 3600),
      checkRateLimit(`application:valid-submit:user:${user.id}`, 5, 3600),
    ]);
    if (!ipAllowed || !userAllowed) {
      return errorResponse(request, { error: "rate_limited", message: "Қысқа уақытта тым көп жарамды жіберу әрекеті жасалды. Кейінірек қайталап көріңіз." }, 429, "rate");
    }

    stage = "submission_transaction";
    const applicationId = await database.$transaction(async (tx) => {
      const claimed = await tx.membershipApplicationDraft.updateMany({
        where: { id: draft.id, status: "draft", submittedApplicationId: null },
        data: { status: "submitting" },
      });
      if (claimed.count === 0) {
        const current = await tx.membershipApplicationDraft.findUniqueOrThrow({ where: { id: draft.id }, select: { submittedApplicationId: true } });
        if (current.submittedApplicationId) return current.submittedApplicationId;
        throw new Error("DRAFT_SUBMISSION_IN_PROGRESS");
      }

      const existing = await tx.membershipApplication.findFirst({
        where: { personId: user.profileId, archivedAt: null, status: { in: ["awaiting_review", "reserve"] } },
        select: { id: true },
      });
      if (existing) {
        await tx.membershipApplicationDraft.update({ where: { id: draft.id }, data: { status: "submitted", submittedApplicationId: existing.id } });
        return existing.id;
      }

      const id = crypto.randomUUID();
      const now = new Date();
      await tx.personProfile.update({ where: { id: user.profileId }, data: {
        fullName: [parsed.data.surname, parsed.data.givenName, parsed.data.patronymic].filter(Boolean).join(" "),
        surname: parsed.data.surname,
        givenName: parsed.data.givenName,
        patronymic: parsed.data.patronymic || null,
        birthDate: new Date(`${parsed.data.birthDate}T00:00:00.000Z`),
        birthYear: Number(parsed.data.birthDate.slice(0, 4)),
        regionCode: parsed.data.regionCode,
        cityDistrict: parsed.data.cityDistrict,
        phone: parsed.data.phone,
        workplace: parsed.data.workplace || null,
        position: parsed.data.position || null,
        educationLevelCode: parsed.data.educationLevelCode,
        educationInstitution: parsed.data.educationInstitution || null,
        educationProgram: parsed.data.educationProgram || null,
        mathSpecialization: parsed.data.mathSpecialization || null,
        achievements: parsed.data.achievements || null,
        membershipStatus: "applicant",
        branchId: branch.id,
        updatedAt: now,
      } });
      await tx.membershipApplication.create({ data: {
        id,
        personId: user.profileId,
        branchId: branch.id,
        status: "awaiting_review",
        submittedAt: now,
        termsVersion: "2026.1",
        termsAcceptedAt: now,
        privacyPolicyVersion: "2026.1",
        privacyAcceptedAt: now,
        source: parsed.data.source,
        joiningPurpose: parsed.data.joiningPurpose,
      } });
      await tx.membershipStatusHistory.create({ data: {
        id: crypto.randomUUID(),
        personId: user.profileId,
        applicationId: id,
        previousStatus: "registered_user",
        newStatus: "applicant",
        reason: "Өтініш қабылданды",
        visibility: "member",
        changedBy: user.id,
        createdAt: now,
      } });
      await tx.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: user.id,
        actionType: "application.submitted",
        targetEntity: "membership_application",
        targetEntityId: id,
        newValue: JSON.stringify({ status: "awaiting_review", branchId: branch.id, draftId: draft.id }),
        reason: "Сақталған draft пайдаланушының нақты растауымен жіберілді",
        ipAddress,
        createdAt: now,
      } });
      await tx.uploadedDocument.updateMany({
        where: { draftId: draft.id, ownerPersonId: user.profileId, status: "active", archivedAt: null },
        data: { draftId: null, applicationId: id, visibility: "reviewers", updatedAt: now },
      });
      await tx.membershipApplicationDraft.update({
        where: { id: draft.id },
        data: { status: "submitted", submittedApplicationId: id, termsAccepted: true, privacyAccepted: true, updatedAt: now },
      });
      return id;
    }, { maxWait: 10_000, timeout: 30_000 });

    return successResponse(request, applicationId);
  } catch (error) {
    if (error instanceof Error && error.message === "DRAFT_SUBMISSION_IN_PROGRESS") {
      return errorResponse(request, { error: "submission_in_progress", message: "Өтініш жіберіліп жатыр. Қайталап баспаңыз." }, 409, "unexpected");
    }
    logRuntimeError("application.submit.runtime_error", stage, error);
    return errorResponse(request, { error: "unexpected", message: "Өтінішті жіберу мүмкін болмады. Draft сақталды." }, 500, "unexpected");
  }
}
