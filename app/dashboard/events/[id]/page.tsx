/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal dashboard left-click navigation. */
import { ArrowLeft, DoorOpen, ExternalLink, FileText, Monitor, Newspaper, ShieldCheck, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { EventForm } from "@/app/components/EventForm";
import { getEventFormOptions, getManagedEvent } from "@/db/events";
import { getEventParticipationSummary } from "@/db/event-participation";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessManagedEvent, canGenerateEventNews, canManageDynamicContent, canManageEventResults,
  canManageGlobalEvents, canManagePublicMedia, canPublishEvents, canViewEventParticipants,
} from "@/lib/authorization";
import { eventFormatLabel, eventScopeLabel, eventStatusLabel, registrationModeLabel, seatingTypeLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";

function stateMessage(state: { success?: string; error?: string }) {
  if (state.success === "result") return { kind: "success", text: "Құрылымдалған қорытынды сақталды және аудитке жазылды." };
  if (state.success) return { kind: "success", text: "Өзгеріс сақталды және аудит журналына тіркелді." };
  if (state.error === "result-required") return { kind: "error", text: "Іс-шараны аяқтау немесе қорытынды жаңалығын жасау алдында құрылымдалған қорытындыны сақтаңыз." };
  if (state.error) return { kind: "error", text: "Өзгеріс сақталмады. Өрістерді, мәртебе ауысуын және құқықтарды тексеріңіз." };
  return null;
}

export default async function DashboardEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  const { id } = await params;
  const [event, options, state, participation] = await Promise.all([getManagedEvent(id), getEventFormOptions(actor), searchParams, getEventParticipationSummary(id)]);
  if (!event || !canAccessManagedEvent(actor, event)) notFound();
  const message = stateMessage(state);
  const global = canManageGlobalEvents(actor);
  const editable = global || event.status === "DRAFT";
  const canPublish = canPublishEvents(actor);
  const canResult = canManageEventResults(actor) && event.status !== "ARCHIVED";
  const canNews = canGenerateEventNews(actor);
  const canOpenCms = canManageDynamicContent(actor);
  const announcement = event.newsLinks.find((link) => link.relationType === "EVENT_ANNOUNCEMENT");
  const resultNews = event.newsLinks.find((link) => link.relationType === "EVENT_RESULT");

  return <main className="dashboard-content">
    <a className="back-link" href="/dashboard/events"><ArrowLeft size={15} /> Іс-шаралар</a>
    <div className="dash-page-heading"><div><p>{eventScopeLabel(event.eventScope)}</p><h1>{event.title}</h1></div><span className={`content-status ${event.status.toLowerCase()}`}>{eventStatusLabel(event.status)}</span></div>
    {message && <div className={`dash-alert ${message.kind}`}>{message.text}</div>}
    <div className="content-admin-note"><ShieldCheck size={22} /><p>Жариялау, кейінге қалдыру, болдырмау және аяқтау бөлек аудит әрекеті ретінде сақталады. Филиал жобасын тек орталық жариялайды.</p></div>

    <section className="event-facts panel"><div><span>Уақыты</span><strong>{formatDate(event.startAt.toISOString(), true)} — {formatDate(event.endAt.toISOString(), true)}</strong></div><div><span>Форматы</span><strong>{eventFormatLabel(event.eventFormat)}</strong></div><div><span>Тіркелу</span><strong>{registrationModeLabel(event.registrationMode)}</strong></div><div><span>Орын тәртібі</span><strong>{seatingTypeLabel(event.seatingType)}</strong></div><div><span>Жауапты</span><strong>{event.responsibleProfile?.fullName ?? event.responsibleDepartment?.nameKk ?? "Таңдалмаған"}</strong></div></section>
    {canViewEventParticipants(actor) && <section className="event-participation-shortcuts"><div><span>Тіркелген</span><strong>{participation.registered}</strong></div><div><span>Қатысты</span><strong>{participation.present}</strong></div><div><span>Бас тартқан</span><strong>{participation.cancelled}</strong></div><a className="button button-primary" href={`/dashboard/events/${id}/participants`}><Users size={16} /> Қатысушылар</a><a className="button" href={`/dashboard/events/${id}/reception`}><DoorOpen size={16} /> Reception</a><a className="button" href={`/events/${event.slug}/screen`} target="_blank" rel="noreferrer"><Monitor size={16} /> Экран</a></section>}
    {event.statusNote && <div className="event-status-note"><strong>{eventStatusLabel(event.status)}</strong><p>{event.statusNote}</p></div>}

    {editable && <section className="panel event-edit-panel"><div className="panel-heading"><div><span>Негізгі деректер</span><h2>Іс-шараны өңдеу</h2></div></div><EventForm action={`/api/events/${id}`} item={event} options={options} canChooseNational={global} canManageMedia={canManagePublicMedia(actor)} submitLabel="Өзгерісті сақтау" /></section>}
    {!editable && !global && <div className="dash-alert success">Жоба орталық тексеруге жіберілді. Жарияланғанға дейін өңдеу жабық.</div>}

    <section className="panel event-workflow-panel"><div className="panel-heading"><div><span>Мәртебе</span><h2>Жұмыс барысы</h2></div>{event.publishedAt && <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Ашық бет</a>}</div>
      <div className="event-workflow-actions">
        {event.status === "DRAFT" && <form action={`/api/events/${id}`} method="post"><button className="button" name="action" value="submit" type="submit">Орталыққа жіберу</button></form>}
        {canPublish && ["DRAFT", "SUBMITTED", "POSTPONED"].includes(event.status) && <form action={`/api/events/${id}`} method="post"><button className="button button-primary" name="action" value="publish" type="submit">Жариялау</button></form>}
        {canPublish && event.publishedAt && !["CANCELLED", "COMPLETED", "ARCHIVED"].includes(event.status) && <form action={`/api/events/${id}`} method="post"><input name="statusNote" required minLength={3} maxLength={1000} placeholder="Кейінге қалдыру себебі" /><button className="button" name="action" value="postpone" type="submit">Кейінге қалдыру</button></form>}
        {canPublish && event.publishedAt && !["CANCELLED", "COMPLETED", "ARCHIVED"].includes(event.status) && <form action={`/api/events/${id}`} method="post"><input name="statusNote" required minLength={3} maxLength={1000} placeholder="Болдырмау себебі" /><button className="button button-danger" name="action" value="cancel" type="submit">Болдырмау</button></form>}
        {canPublish && event.publishedAt && event.result && !["COMPLETED", "ARCHIVED"].includes(event.status) && <form action={`/api/events/${id}`} method="post"><button className="button button-primary" name="action" value="complete" type="submit">Аяқталды деп белгілеу</button></form>}
        {canPublish && event.status !== "ARCHIVED" && <form action={`/api/events/${id}`} method="post"><input name="statusNote" required minLength={3} maxLength={1000} placeholder="Архивтеу себебі" /><button className="button button-danger" name="action" value="archive" type="submit">Архивке алу</button></form>}
        {canPublish && event.status === "ARCHIVED" && <form action={`/api/events/${id}`} method="post"><button className="button" name="action" value="restore" type="submit">Архивтен қайтару</button></form>}
      </div>
    </section>

    {canResult && <section className="panel event-result-panel"><div className="panel-heading"><div><span>Құрылымдалған дерек</span><h2><FileText size={17} /> Іс-шара қорытындысы</h2></div></div><form action={`/api/events/${id}/result`} method="post">
      <label className="content-field-wide"><span>Не өтті — қысқаша қорытынды</span><textarea name="summary" defaultValue={event.result?.summary ?? ""} required maxLength={1500} rows={4} /></label>
      <label><span>Қатысушылар саны</span><input name="participantCount" defaultValue={event.result?.participantCount ?? ""} type="number" min={0} max={1000000} /></label>
      <label><span>Кімдер қатысты</span><textarea name="audienceDescription" defaultValue={event.result?.audienceDescription ?? ""} maxLength={3000} rows={3} /></label>
      <label><span>Негізгі тақырыптар немесе жұмыстар</span><textarea name="mainTopics" defaultValue={event.result?.mainTopics ?? ""} maxLength={5000} rows={4} /></label>
      <label><span>Нәтижелер</span><textarea name="outcomes" defaultValue={event.result?.outcomes ?? ""} maxLength={5000} rows={4} /></label>
      <label><span>Маңызды шешімдер</span><textarea name="decisions" defaultValue={event.result?.decisions ?? ""} maxLength={5000} rows={4} /></label>
      <label><span>Спикерлер мен сарапшылар</span><textarea name="speakers" defaultValue={event.result?.speakers ?? ""} maxLength={3000} rows={3} /></label>
      <label><span>Материалдар мен фото сілтемелері</span><textarea name="materialReferences" defaultValue={event.result?.materialReferences ?? ""} maxLength={5000} rows={3} /></label>
      <label className="content-field-wide"><span>Қосымша ескертпе</span><textarea name="notes" defaultValue={event.result?.notes ?? ""} maxLength={5000} rows={3} /></label>
      <button className="button button-primary content-field-wide" type="submit">Қорытындыны сақтау</button>
    </form></section>}

    <section className="panel event-news-panel"><div className="panel-heading"><div><span>Қазіргі News жүйесі</span><h2><Newspaper size={17} /> Іс-шара жаңалықтары</h2></div></div><div className="event-news-grid">
      <article><strong>Анонс жаңалығы</strong><p>{announcement ? `${announcement.news.title} · ${announcement.news.status}` : "Іс-шара деректерінен тексерілетін черновик жасалады."}</p>{announcement ? canOpenCms && <a className="button" href={`/dashboard/content/news/${announcement.newsId}`}>Жаңалықты ашу</a> : canNews && <form action={`/api/events/${id}/news`} method="post"><input type="hidden" name="relationType" value="EVENT_ANNOUNCEMENT" /><button className="button" type="submit">Анонс черновигін жасау</button></form>}</article>
      <article><strong>Қорытынды жаңалығы</strong><p>{resultNews ? `${resultNews.news.title} · ${resultNews.news.status}` : event.result ? "Сақталған қорытындыдан бөлек черновик жасалады." : "Алдымен құрылымдалған қорытындыны сақтаңыз."}</p>{resultNews ? canOpenCms && <a className="button" href={`/dashboard/content/news/${resultNews.newsId}`}>Жаңалықты ашу</a> : canNews && event.result && <form action={`/api/events/${id}/news`} method="post"><input type="hidden" name="relationType" value="EVENT_RESULT" /><button className="button" type="submit">Қорытынды черновигін жасау</button></form>}</article>
    </div></section>
  </main>;
}
