import type { Prisma } from "@/generated/prisma/client";
import { projectParticipantRoleLabel } from "@/lib/projects";

export async function syncProjectParticipantActivity(
  transaction: Prisma.TransactionClient,
  participant: { id: string; projectId: string; personId: string; participantRole: string; status: string; completedAt: Date | null },
  project: { title: string; startDate: Date },
  now = new Date(),
) {
  if (participant.status === "COMPLETED") {
    await transaction.personActivity.upsert({
      where: { projectParticipantId: participant.id },
      create: {
        id: crypto.randomUUID(), personId: participant.personId, projectId: participant.projectId, projectParticipantId: participant.id,
        activityType: "PROJECT_PARTICIPATION", title: project.title,
        description: `Жобадағы рөлі: ${projectParticipantRoleLabel(participant.participantRole)}`,
        occurredAt: participant.completedAt ?? project.startDate, status: "ACTIVE", createdAt: now, updatedAt: now,
      },
      update: {
        title: project.title, description: `Жобадағы рөлі: ${projectParticipantRoleLabel(participant.participantRole)}`,
        occurredAt: participant.completedAt ?? project.startDate, status: "ACTIVE", revokedAt: null, updatedAt: now,
      },
    });
    return;
  }
  await transaction.personActivity.updateMany({
    where: { projectParticipantId: participant.id, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now, updatedAt: now },
  });
}
