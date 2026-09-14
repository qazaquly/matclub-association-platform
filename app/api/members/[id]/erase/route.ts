import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { lockAccessGovernance } from "@/lib/access-governance";
import { authenticateRequest } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";
import { logRuntimeError } from "@/lib/runtime-error";

const schema = z.object({
  confirmation: z.literal("ӨШІРУ"),
  reason: z.string().trim().min(5).max(500),
});

class EraseError extends Error {
  constructor(public readonly code: string) { super(code); }
}

function membersPath(request: Request, code: string, kind: "success" | "error" = "error") {
  return new URL(`/dashboard/members?${kind}=${encodeURIComponent(code)}`, request.url);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor || !isFullAccess(actor)) return new Response("Forbidden", { status: 403 });

    const { id } = await context.params;
    const parsed = schema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(membersPath(request, "confirmation"), 303);

    stage = "database";
    await ensureDatabase();
    const database = getDb();
    const now = new Date();
    const objectKeys = await database.$transaction(async (tx) => {
      stage = "governance_lock";
      await lockAccessGovernance(tx);
      stage = "target_lookup";
      const target = await tx.personProfile.findFirst({
        where: { id, archivedAt: null },
        select: {
          id: true,
          userId: true,
          membershipStatus: true,
          applications: { select: { id: true } },
          documents: { select: { objectKey: true } },
        },
      });

      if (!target) throw new EraseError("not_found");
      if (target.userId === actor.id) throw new EraseError("self");

      const applicationIds = target.applications.map((application) => application.id);
      const erasedEmail = `erased+${target.id}@deleted.invalid`;
      stage = "identity_claim";
      const claimed = await tx.personProfile.updateMany({
        where: { id: target.id, archivedAt: null },
        data: {
          fullName: "Өшірілген аккаунт",
          surname: null,
          givenName: null,
          patronymic: null,
          birthDate: null,
          birthYear: null,
          regionCode: "",
          cityDistrict: "",
          phone: "",
          email: erasedEmail,
          workplace: null,
          position: null,
          education: null,
          educationLevelCode: null,
          educationInstitution: null,
          educationProgram: null,
          professionalExperience: null,
          mathSpecialization: null,
          achievements: null,
          biography: null,
          membershipStatus: "erased",
          membershipStartedAt: null,
          branchId: null,
          archivedAt: now,
          updatedAt: now,
        },
      });
      if (claimed.count !== 1) throw new EraseError("conflict");

      stage = "access_cleanup";
      if (target.userId) {
        await tx.userRole.updateMany({ where: { userId: target.userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.branchStaff.updateMany({ where: { userId: target.userId, activeTo: null }, data: { activeTo: now } });
      }
      await tx.branch.updateMany({ where: { directorProfileId: target.id }, data: { directorProfileId: null, updatedAt: now } });
      await tx.personDepartmentAssignment.updateMany({ where: { personId: target.id, endedAt: null }, data: { endedAt: now, endedBy: actor.id } });
      await tx.personProfessionalCategoryAssignment.updateMany({ where: { personId: target.id, removedAt: null }, data: { removedAt: now, removedBy: actor.id } });
      await tx.event.updateMany({ where: { responsibleProfileId: target.id }, data: { responsibleProfileId: null, updatedAt: now } });
      await tx.project.updateMany({ where: { leaderProfileId: target.id }, data: { leaderProfileId: null, updatedAt: now } });
      await tx.news.updateMany({ where: { authorProfileId: target.id }, data: { authorProfileId: null, authorText: null, updatedAt: now } });
      await tx.publication.updateMany({ where: { authorProfileId: target.id }, data: { authorProfileId: null, authorText: null, updatedAt: now } });

      stage = "history_anonymization";
      await tx.eventRegistration.updateMany({
        where: { personId: target.id },
        data: { fullName: "Өшірілген қатысушы", email: null, phone: null, organization: null, regionName: null, guestGroup: null, updatedAt: now },
      });
      await tx.projectParticipant.updateMany({ where: { personId: target.id }, data: { notes: null, updatedAt: now } });
      await tx.personActivity.updateMany({ where: { personId: target.id }, data: { description: null, updatedAt: now } });

      stage = "personal_data_cleanup";
      if (target.userId) {
        await tx.emailVerificationToken.deleteMany({ where: { userId: target.userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId: target.userId } });
      }
      await tx.applicationFieldValue.deleteMany({ where: { applicationId: { in: applicationIds } } });
      await tx.internalNote.deleteMany({
        where: {
          OR: [
            { personId: target.id },
            ...(applicationIds.length ? [{ applicationId: { in: applicationIds } }] : []),
          ],
        },
      });
      await tx.uploadedDocument.deleteMany({ where: { ownerPersonId: target.id } });
      await tx.membershipApplicationDraft.deleteMany({ where: { personId: target.id } });
      await tx.membershipApplication.updateMany({
        where: { personId: target.id },
        data: { status: "erased", decisionReason: null, joiningPurpose: null, archivedAt: now },
      });
      if (target.userId) {
        await tx.user.update({
          where: { id: target.userId },
          data: {
            email: erasedEmail,
            passwordHash: null,
            emailVerifiedAt: null,
            status: "erased",
            lastLoginAt: null,
            archivedAt: now,
            updatedAt: now,
          },
        });
      }
      await tx.membershipStatusHistory.create({
        data: {
          id: crypto.randomUUID(),
          personId: target.id,
          applicationId: null,
          previousStatus: target.membershipStatus,
          newStatus: "erased",
          reason: parsed.data.reason,
          visibility: "internal",
          changedBy: actor.id,
          createdAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          actorUserId: actor.id,
          actionType: "person.erased",
          targetEntity: "person_profile",
          targetEntityId: target.id,
          previousValue: JSON.stringify({ membershipStatus: target.membershipStatus, applicationCount: applicationIds.length, documentCount: target.documents.length }),
          newValue: JSON.stringify({ accountStatus: "erased", personalDataRemoved: true, filesRemoved: target.documents.length }),
          reason: parsed.data.reason,
          ipAddress: clientIp(request),
          sessionId: actor.sessionId,
          createdAt: now,
        },
      });

      return target.documents.map((document) => document.objectKey);
    }, { maxWait: 10_000, timeout: 30_000 });

    stage = "private_file_purge";
    const storage = getPrivateObjectStorage();
    await Promise.all(objectKeys.map((key) => storage.delete(key)));
    return Response.redirect(membersPath(request, "erased", "success"), 303);
  } catch (error) {
    if (error instanceof EraseError) {
      if (error.code === "not_found") return new Response("Not found", { status: 404 });
      return Response.redirect(membersPath(request, error.code), 303);
    }
    logRuntimeError("person.erase.runtime_error", stage, error);
    return Response.redirect(membersPath(request, "unexpected"), 303);
  }
}
