import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAccessManagedEvent, canGenerateEventNews, canManageDynamicContent } from "@/lib/authorization";
import { normalizeSlug, serializeAuditValue } from "@/lib/dynamic-content";
import { eventLocation, isEventNewsRelationType } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { assertSameOrigin, clientIp } from "@/lib/security";

async function availableSlug(transaction: Prisma.TransactionClient, base: string) {
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix ? `${base}-${suffix + 1}`.slice(0, 120) : base.slice(0, 120);
    if (!(await transaction.news.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base.slice(0, 108)}-${crypto.randomUUID().slice(0, 8)}`;
}

function announcementBody(event: {
  description: string; startAt: Date; endAt: Date; eventFormat: string; venue: string | null; regionName: string | null;
  branch: { regionName: string } | null; audience: string; organizer: string; registrationMode: string; externalRegistrationUrl: string | null;
}) {
  const registration = event.registrationMode === "EXTERNAL_LINK" && event.externalRegistrationUrl
    ? `\n\n## Тіркелу\n[Тіркелу сілтемесін ашу](${event.externalRegistrationUrl})`
    : "";
  return `${event.description}\n\n## Негізгі ақпарат\n- Басталуы: ${formatDate(event.startAt.toISOString(), true)}\n- Аяқталуы: ${formatDate(event.endAt.toISOString(), true)}\n- Өтетін орны: ${eventLocation(event)}\n- Қатысушылар: ${event.audience}\n- Ұйымдастырушы: ${event.organizer}${registration}`;
}

function resultBody(event: { title: string }, result: {
  summary: string; participantCount: number | null; audienceDescription: string | null; mainTopics: string | null;
  outcomes: string | null; decisions: string | null; speakers: string | null; notes: string | null; materialReferences: string | null;
}) {
  const sections = [
    result.participantCount == null ? null : `- Қатысушылар саны: ${result.participantCount}`,
    result.audienceDescription ? `- Қатысушылар: ${result.audienceDescription}` : null,
    result.mainTopics ? `\n## Негізгі тақырыптар мен жұмыстар\n${result.mainTopics}` : null,
    result.outcomes ? `\n## Нәтижелер\n${result.outcomes}` : null,
    result.decisions ? `\n## Маңызды шешімдер\n${result.decisions}` : null,
    result.speakers ? `\n## Спикерлер мен сарапшылар\n${result.speakers}` : null,
    result.materialReferences ? `\n## Материалдар\n${result.materialReferences}` : null,
    result.notes ? `\n## Қосымша ақпарат\n${result.notes}` : null,
  ].filter(Boolean).join("\n");
  return `${result.summary}\n\n${sections || `${event.title} іс-шарасының қорытынды ақпараты.`}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!canGenerateEventNews(actor)) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const relationType = String(form.get("relationType") ?? "");
  if (!isEventNewsRelationType(relationType)) return Response.redirect(new URL(`/dashboard/events/${id}?error=validation`, request.url), 303);
  const database = getDb();
  const event = await database.event.findUnique({ where: { id }, include: { branch: true, result: true } });
  if (!event) return new Response("Not found", { status: 404 });
  if (!canAccessManagedEvent(actor, event)) return new Response("Forbidden", { status: 403 });
  if (relationType === "EVENT_RESULT" && !event.result) return Response.redirect(new URL(`/dashboard/events/${id}?error=result-required`, request.url), 303);

  const existing = await database.eventNewsLink.findUnique({
    where: { eventId_relationType: { eventId: id, relationType } }, include: { news: { select: { id: true } } },
  });
  if (existing) return Response.redirect(new URL(canManageDynamicContent(actor) ? `/dashboard/content/news/${existing.news.id}?event=${id}` : `/dashboard/events/${id}?success=news-existing`, request.url), 303);

  const now = new Date();
  try {
    const newsId = await database.$transaction(async (transaction) => {
      const duplicate = await transaction.eventNewsLink.findUnique({
        where: { eventId_relationType: { eventId: id, relationType } }, select: { newsId: true },
      });
      if (duplicate) return duplicate.newsId;
      const announcement = relationType === "EVENT_ANNOUNCEMENT";
      const title = `${event.title}: ${announcement ? "анонс" : "қорытынды"}`;
      const slug = await availableSlug(transaction, normalizeSlug(`${event.slug}-${announcement ? "anons" : "korytyndy"}`));
      const body = announcement ? announcementBody(event) : resultBody(event, event.result!);
      const lead = announcement ? event.summary : event.result!.summary;
      const newsId = crypto.randomUUID();
      const news = await transaction.news.create({ data: {
        id: newsId, title, slug, lead, body, bodyFormat: "restricted_markdown", coverMediaId: event.coverMediaId,
        authorText: event.organizer, status: "DRAFT", createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now,
      } });
      const link = await transaction.eventNewsLink.create({ data: {
        id: crypto.randomUUID(), eventId: id, newsId, relationType, createdBy: actor.id, createdAt: now,
      } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: announcement ? "event.announcement_draft_created" : "event.result_news_draft_created",
        targetEntity: "event", targetEntityId: id, newValue: serializeAuditValue({ news, link }),
        reason: announcement ? "Іс-шарадан анонс жаңалығының жобасы жасалды" : "Іс-шара қорытындысынан жаңалық жобасы жасалды",
        ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
      return newsId;
    });
    return Response.redirect(new URL(canManageDynamicContent(actor) ? `/dashboard/content/news/${newsId}?event=${id}&success=generated` : `/dashboard/events/${id}?success=news-generated`, request.url), 303);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      const duplicate = await database.eventNewsLink.findUnique({ where: { eventId_relationType: { eventId: id, relationType } }, select: { newsId: true } });
      if (duplicate) return Response.redirect(new URL(canManageDynamicContent(actor) ? `/dashboard/content/news/${duplicate.newsId}?event=${id}` : `/dashboard/events/${id}?success=news-existing`, request.url), 303);
    }
    throw error;
  }
}
