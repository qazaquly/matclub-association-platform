/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Vinext navigation and database-backed media require native elements here. */
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/app/components/PublicShell";
import { SafeMarkdown } from "@/app/components/SafeMarkdown";
import { getPublicEvent } from "@/db/events";
import { getPublicEventRegistrationState } from "@/db/event-participation";
import { getCurrentUser } from "@/lib/auth";
import { registrationIsOpen } from "@/lib/event-participation";
import { eventFormatLabel, eventLocation, eventScopeLabel, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = await getPublicEvent((await params).slug);
  if (!event) return {};
  const image = event.coverMediaId ? `/api/public-media/${event.coverMediaId}` : undefined;
  return {
    title: event.title, description: event.summary,
    openGraph: { title: event.title, description: event.summary, images: image ? [image] : [] },
    twitter: { title: event.title, description: event.summary, images: image ? [image] : [] },
  };
}

function registrationMessage(state: { success?: string; error?: string }) {
  if (state.success === "registered") return { kind: "success", text: "Сіз іс-шараға тіркелдіңіз." };
  if (state.success === "cancelled") return { kind: "success", text: "Тіркелуіңіз тоқтатылды." };
  if (state.error === "full") return { kind: "error", text: "Қатысушылар орны толды. Күту тізімі қарастырылмаған." };
  if (state.error === "members-only") return { kind: "error", text: "Ішкі тіркелу тек толық мүшелерге қолжетімді." };
  if (state.error === "registration-closed" || state.error === "event-started") return { kind: "error", text: "Бұл іс-шараға тіркелу немесе бас тарту мерзімі жабылды." };
  if (state.error) return { kind: "error", text: "Әрекет орындалмады. Кейінірек қайталап көріңіз." };
  return null;
}

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ slug }, actor, state] = await Promise.all([params, getCurrentUser(), searchParams]);
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const registrationState = event.registrationMode === "INTERNAL_MEMBERS"
    ? await getPublicEventRegistrationState(event.id, actor?.profileId)
    : null;
  const message = registrationMessage(state);
  const open = registrationIsOpen(event);
  const full = Boolean(event.participantLimit != null && registrationState && registrationState.activeCount >= event.participantLimit);
  const statusAlert = event.status === "POSTPONED" || event.status === "CANCELLED";
  return <PublicShell><main>
    <section className="event-detail-hero"><div className="container narrow"><a className="event-back" href="/events"><ArrowLeft size={15} /> Іс-шаралар</a><div className="event-meta-row"><span>{eventScopeLabel(event.eventScope)}</span><span>{eventFormatLabel(event.eventFormat)}</span><span>{eventStatusLabel(event.status)}</span></div><h1>{event.title}</h1><p>{event.summary}</p><div className="event-hero-facts"><span><CalendarDays size={17} /> {formatDate(event.startAt.toISOString(), true)}</span><span><MapPin size={17} /> {eventLocation(event)}</span><span><Users size={17} /> {event.audience}</span></div></div></section>
    {statusAlert && <div className={`container narrow event-public-alert ${event.status.toLowerCase()}`}><strong>{eventStatusLabel(event.status)}</strong><p>{event.statusNote ?? "Іс-шара мәртебесі өзгерді. Жаңартылған ақпарат осы бетте жарияланады."}</p></div>}
    {event.coverMediaId && <div className="container narrow article-cover"><img src={`/api/public-media/${event.coverMediaId}`} alt={event.title} /></div>}
    <section className="section container event-detail-grid"><article><SafeMarkdown source={event.description} />
      {event.status === "COMPLETED" && event.result && <div className="public-event-result"><p className="eyebrow dark">Қорытынды</p><h2>{event.result.summary}</h2>{event.result.participantCount != null && <p><strong>Қатысушылар саны:</strong> {event.result.participantCount}</p>}{event.result.audienceDescription && <p><strong>Қатысқандар:</strong> {event.result.audienceDescription}</p>}{event.result.mainTopics && <><h3>Негізгі тақырыптар</h3><p>{event.result.mainTopics}</p></>}{event.result.outcomes && <><h3>Нәтижелер</h3><p>{event.result.outcomes}</p></>}{event.result.decisions && <><h3>Маңызды шешімдер</h3><p>{event.result.decisions}</p></>}</div>}
    </article><aside>
      <div className="event-detail-card"><span>Ұйымдастырушы</span><strong>{event.organizer}</strong>{event.responsibleProfile && <small>Жауапты: {event.responsibleProfile.fullName}</small>}{event.responsibleDepartment && <small>{event.responsibleDepartment.nameKk}</small>}</div>
      {event.registrationMode === "EXTERNAL_LINK" && event.externalRegistrationUrl && event.status !== "CANCELLED" && <a className="button button-primary event-registration-button" href={event.externalRegistrationUrl} target="_blank" rel="noreferrer">Тіркелу <ExternalLink size={16} /></a>}
      {event.registrationMode === "INTERNAL_MEMBERS" && registrationState && <div className="event-registration-panel">
        <span>Мүшелер үшін тіркелу</span>
        <strong>{event.participantLimit == null ? `${registrationState.activeCount} адам тіркелді` : `${registrationState.activeCount} / ${event.participantLimit} орын`}</strong>
        {message && <p className={`registration-message ${message.kind}`}>{message.text}</p>}
        {!actor && <><p>Тіркелу үшін мүшелік аккаунтыңызға кіріңіз.</p><a className="button button-primary" href="/login">Аккаунтқа кіру</a></>}
        {actor && actor.membershipStatus !== "member" && <p>Ішкі тіркелу тек толық мүшелерге қолжетімді. Үміткерлер мен резерв үшін ұйымдастырушының сыртқы сілтемесі қолданылады.</p>}
        {actor?.membershipStatus === "member" && registrationState.ownRegistration?.registrationStatus === "REGISTERED" && <>
          <p>Сіз тіркелгенсіз.{registrationState.ownRegistration.seatingUnit ? ` Орыныңыз: ${registrationState.ownRegistration.seatingUnit.label}-${registrationState.ownRegistration.seatNumber}.` : ""}</p>
          {event.startAt > new Date() && <form action={`/api/events/${event.id}/registration`} method="post"><button className="button" name="action" value="cancel" type="submit">Тіркелуден бас тарту</button></form>}
        </>}
        {actor?.membershipStatus === "member" && registrationState.ownRegistration?.registrationStatus !== "REGISTERED" && <>
          {open && !full ? <form action={`/api/events/${event.id}/registration`} method="post"><button className="button button-primary" name="action" value="register" type="submit">Іс-шараға тіркелу</button></form>
            : <p>{full ? "Қатысушылар орны толды." : "Тіркелу жабық."}</p>}
        </>}
        <a className="event-live-link" href={`/events/${event.slug}/screen`}>Іс-шараның жалпы көрсеткіші</a>
      </div>}
      {event.newsLinks.length > 0 && <div className="event-related-news"><strong>Қатысты жаңалықтар</strong>{event.newsLinks.map((link) => <a href={`/news/${link.news.slug}`} key={link.id}>{link.news.title}<ArrowRight size={14} /></a>)}</div>}
    </aside></section>
  </main></PublicShell>;
}
