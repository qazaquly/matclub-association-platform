import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/db";
import { serializeAuditValue } from "@/lib/dynamic-content";
import { getPublicObjectStorage } from "@/lib/storage";
import type { PublicObjectStorage } from "@/lib/storage";

export const ARCHIVE_RETENTION_DAYS = 60;
const DAY_MS = 86_400_000;
const CONTENT_BATCH_SIZE = 100;
const MEDIA_BATCH_SIZE = 100;
const UNUSED_MEDIA_GRACE_DAYS = 1;
const STALE_PURGE_RETRY_DAYS = 1;

const noMediaReferences = {
  newsCovers: { none: {} },
  publicationCovers: { none: {} },
  partnerLogos: { none: {} },
  projectCovers: { none: {} },
  eventCovers: { none: {} },
} as const;

interface RetentionResult {
  skipped: boolean;
  deletedNews: number;
  deletedDrafts: number;
  archivedUnusedMedia: number;
  deletedMedia: number;
  failedMedia: number;
}

function cutoffDate(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS);
}

async function archiveDetachedMedia(
  transaction: Prisma.TransactionClient,
  mediaId: string | null,
  archivedAt: Date,
) {
  if (!mediaId) return;
  await transaction.publicMedia.updateMany({
    where: { id: mediaId, status: "active", ...noMediaReferences },
    data: { status: "archived", archivedAt, purgeStartedAt: null },
  });
}

async function deleteExpiredContent(database: ReturnType<typeof getDb>, now: Date, cutoff: Date) {
  return database.$transaction(async (transaction) => {
    const lock = await transaction.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(20260901, 60) AS locked
    `;
    if (!lock[0]?.locked) return { skipped: true, deletedNews: 0, deletedDrafts: 0 };

    let deletedNews = 0;
    let deletedDrafts = 0;
    const news = await transaction.news.findMany({
      where: { status: "ARCHIVED", archivedAt: { lte: cutoff }, eventLinks: { none: {} } },
      orderBy: { archivedAt: "asc" },
      take: CONTENT_BATCH_SIZE,
    });
    for (const item of news) {
      const deleted = await transaction.news.deleteMany({
        where: { id: item.id, status: "ARCHIVED", archivedAt: { lte: cutoff }, eventLinks: { none: {} } },
      });
      if (!deleted.count) continue;
      deletedNews += deleted.count;
      await archiveDetachedMedia(transaction, item.coverMediaId, item.archivedAt ?? now);
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: null,
        actionType: "dynamic_content.retention_deleted",
        targetEntity: "news",
        targetEntityId: item.id,
        previousValue: serializeAuditValue(item),
        newValue: JSON.stringify({ deleted: true, retentionDays: ARCHIVE_RETENTION_DAYS }),
        reason: "Архивтегі жаңалық 60 күндік сақтау мерзімі аяқталған соң автоматты өшірілді",
        createdAt: now,
      } });
    }

    const remainingDraftSlots = Math.max(0, CONTENT_BATCH_SIZE - deletedNews);
    const publications = remainingDraftSlots ? await transaction.publication.findMany({
      where: { status: "ARCHIVED", archivedAt: { lte: cutoff }, publishedAt: null },
      orderBy: { archivedAt: "asc" },
      take: remainingDraftSlots,
    }) : [];
    for (const item of publications) {
      const deleted = await transaction.publication.deleteMany({
        where: { id: item.id, status: "ARCHIVED", archivedAt: { lte: cutoff }, publishedAt: null },
      });
      if (!deleted.count) continue;
      deletedDrafts += deleted.count;
      await archiveDetachedMedia(transaction, item.coverMediaId, item.archivedAt ?? now);
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: null,
        actionType: "dynamic_content.retention_deleted", targetEntity: "publications", targetEntityId: item.id,
        previousValue: serializeAuditValue(item),
        newValue: JSON.stringify({ deleted: true, retentionDays: ARCHIVE_RETENTION_DAYS, neverPublished: true }),
        reason: "Жарияланбаған архив жобасы 60 күндік сақтау мерзімі аяқталған соң автоматты өшірілді",
        createdAt: now,
      } });
    }

    const remainingProjectSlots = Math.max(0, remainingDraftSlots - deletedDrafts);
    const projects = remainingProjectSlots ? await transaction.publicProject.findMany({
      where: { status: "ARCHIVED", archivedAt: { lte: cutoff }, publishedAt: null },
      orderBy: { archivedAt: "asc" },
      take: remainingProjectSlots,
    }) : [];
    for (const item of projects) {
      const deleted = await transaction.publicProject.deleteMany({
        where: { id: item.id, status: "ARCHIVED", archivedAt: { lte: cutoff }, publishedAt: null },
      });
      if (!deleted.count) continue;
      deletedDrafts += deleted.count;
      await archiveDetachedMedia(transaction, item.coverMediaId, item.archivedAt ?? now);
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: null,
        actionType: "dynamic_content.retention_deleted", targetEntity: "projects", targetEntityId: item.id,
        previousValue: serializeAuditValue(item),
        newValue: JSON.stringify({ deleted: true, retentionDays: ARCHIVE_RETENTION_DAYS, neverPublished: true }),
        reason: "Жарияланбаған архив жобасы 60 күндік сақтау мерзімі аяқталған соң автоматты өшірілді",
        createdAt: now,
      } });
    }

    return { skipped: false, deletedNews, deletedDrafts };
  });
}

async function archiveUnusedPublicMedia(database: ReturnType<typeof getDb>, now: Date) {
  const candidates = await database.publicMedia.findMany({
    where: {
      status: "active",
      createdAt: { lte: cutoffDate(now, UNUSED_MEDIA_GRACE_DAYS) },
      ...noMediaReferences,
    },
    orderBy: { createdAt: "asc" },
    take: MEDIA_BATCH_SIZE,
    select: { id: true },
  });
  if (!candidates.length) return 0;
  const archived = await database.publicMedia.updateMany({
    where: {
      id: { in: candidates.map((item) => item.id) },
      status: "active",
      ...noMediaReferences,
    },
    data: { status: "archived", archivedAt: now, purgeStartedAt: null },
  });
  return archived.count;
}

async function claimExpiredMedia(database: ReturnType<typeof getDb>, now: Date, cutoff: Date) {
  const stalePurge = cutoffDate(now, STALE_PURGE_RETRY_DAYS);
  return database.$transaction(async (transaction) => {
    const candidates = await transaction.publicMedia.findMany({
      where: {
        OR: [
          { status: "archived", archivedAt: { lte: cutoff } },
          { status: "purging", purgeStartedAt: { lte: stalePurge } },
        ],
        ...noMediaReferences,
      },
      orderBy: { archivedAt: "asc" },
      take: MEDIA_BATCH_SIZE,
    });
    const claimed = [];
    for (const item of candidates) {
      const result = await transaction.publicMedia.updateMany({
        where: {
          id: item.id,
          OR: [
            { status: "archived", archivedAt: { lte: cutoff } },
            { status: "purging", purgeStartedAt: { lte: stalePurge } },
          ],
          ...noMediaReferences,
        },
        data: { status: "purging", purgeStartedAt: now },
      });
      if (result.count) claimed.push(item);
    }
    return claimed;
  });
}

async function purgeClaimedMedia(database: ReturnType<typeof getDb>, storage: PublicObjectStorage, now: Date, cutoff: Date) {
  const claimed = await claimExpiredMedia(database, now, cutoff);
  let deletedMedia = 0;
  let failedMedia = 0;

  for (const media of claimed) {
    try {
      await storage.delete(media.objectKey);
      const deleted = await database.$transaction(async (transaction) => {
        const result = await transaction.publicMedia.deleteMany({
          where: { id: media.id, status: "purging", ...noMediaReferences },
        });
        if (!result.count) return 0;
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: null,
          actionType: "public_media.retention_deleted", targetEntity: "public_media", targetEntityId: media.id,
          previousValue: serializeAuditValue(media),
          newValue: JSON.stringify({ deleted: true, retentionDays: ARCHIVE_RETENTION_DAYS }),
          reason: "Еш жерде қолданылмайтын ашық файл архивте 60 күн тұрған соң автоматты өшірілді",
          createdAt: now,
        } });
        return result.count;
      });
      deletedMedia += deleted;
    } catch (error) {
      failedMedia += 1;
      console.error(JSON.stringify({
        message: "archive retention media purge failed",
        mediaId: media.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return { deletedMedia, failedMedia };
}

export async function runArchiveRetentionWithDependencies(
  database: ReturnType<typeof getDb>,
  storage: PublicObjectStorage,
  now = new Date(),
): Promise<RetentionResult> {
  const cutoff = cutoffDate(now, ARCHIVE_RETENTION_DAYS);
  const content = await deleteExpiredContent(database, now, cutoff);
  if (content.skipped) return {
    skipped: true, deletedNews: 0, deletedDrafts: 0, archivedUnusedMedia: 0, deletedMedia: 0, failedMedia: 0,
  };
  const archivedUnusedMedia = await archiveUnusedPublicMedia(database, now);
  const media = await purgeClaimedMedia(database, storage, now, cutoff);
  return { ...content, archivedUnusedMedia, ...media };
}

export async function runArchiveRetention(now = new Date()): Promise<RetentionResult> {
  return runArchiveRetentionWithDependencies(getDb(), getPublicObjectStorage(), now);
}
