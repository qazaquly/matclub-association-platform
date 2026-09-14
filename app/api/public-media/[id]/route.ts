import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedEvent, canManageDynamicContent } from "@/lib/authorization";
import { publicEventStatuses } from "@/lib/events";
import { getPublicObjectStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = getDb();
  const media = await database.publicMedia.findFirst({ where: { id, status: { in: ["active", "archived"] } } });
  if (!media) return new Response("Not found", { status: 404 });

  const [news, publication, partner, project, events] = await Promise.all([
    database.news.count({ where: { coverMediaId: id, status: "PUBLISHED", archivedAt: null } }),
    database.publication.count({ where: { coverMediaId: id, status: "PUBLISHED", archivedAt: null } }),
    database.partner.count({ where: { logoMediaId: id, status: "active" } }),
    database.publicProject.count({ where: { coverMediaId: id, status: "PUBLISHED", archivedAt: null } }),
    database.event.findMany({ where: { coverMediaId: id, status: { in: [...publicEventStatuses] }, publishedAt: { not: null }, archivedAt: null }, select: { id: true, branchId: true } }),
  ]);
  let allowed = media.status === "active" && news + publication + partner + project + events.length > 0;
  if (!allowed) {
    const actor = await authenticateRequest(request).catch(() => null);
    if (actor) {
      const managedEvent = await database.event.findFirst({ where: { coverMediaId: id }, select: { branchId: true } });
      allowed = canManageDynamicContent(actor) || Boolean(managedEvent && canAccessManagedEvent(actor, managedEvent));
    }
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const object = await getPublicObjectStorage().get(media.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": media.mimeType,
    "Content-Length": String(media.sizeBytes),
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
  } });
}
