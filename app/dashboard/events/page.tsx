import { CalendarDays, Plus, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { EventForm } from "@/app/components/EventForm";
import { getEventFormOptions, listManagedEvents } from "@/db/events";
import { getCurrentUser } from "@/lib/auth";
import { canManageBranchEvents, canManageGlobalEvents, canManagePublicMedia } from "@/lib/authorization";
import { eventScopeLabel, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";

export default async function DashboardEventsPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string; branchId?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageGlobalEvents(actor) && !canManageBranchEvents(actor)) notFound();
  const [allItems, options, state] = await Promise.all([listManagedEvents(actor), getEventFormOptions(actor), searchParams]);
  const items = allItems.filter((item) => (!state.status || item.status === state.status) && (!state.scope || item.eventScope === state.scope) && (!state.branchId || item.branchId === state.branchId));

  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Phase 2.2</p><h1>Іс-шаралар</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Тұрақты тарих</span></div>
    {state.error && <div className="dash-alert error">Іс-шара сақталмады. Міндетті өрістерді, күндерді, деңгейді және сілтемелерді тексеріңіз.</div>}
    <form className="event-filter" method="get">
      <label>Мәртебе<select name="status" defaultValue={state.status ?? ""}><option value="">Барлығы</option><option value="DRAFT">Жоба</option><option value="SUBMITTED">Жіберілген</option><option value="PUBLISHED">Жарияланған</option><option value="POSTPONED">Кейінге қалған</option><option value="CANCELLED">Болдырылмаған</option><option value="COMPLETED">Аяқталған</option><option value="ARCHIVED">Архив</option></select></label>
      <label>Деңгей<select name="scope" defaultValue={state.scope ?? ""}><option value="">Барлығы</option><option value="NATIONAL">Республикалық</option><option value="BRANCH">Филиалдық</option></select></label>
      {state.branchId && <input name="branchId" type="hidden" value={state.branchId} />}
      <button className="button" type="submit">Сүзу</button>
    </form>
    <div className="event-admin-layout">
      <section className="panel event-create-panel"><div className="panel-heading"><div><span>Жаңа жоба</span><h2><Plus size={17} /> Іс-шара ашу</h2></div></div><EventForm action="/api/events" options={options} canChooseNational={canManageGlobalEvents(actor)} canManageMedia={canManagePublicMedia(actor)} submitLabel="Жобаны сақтау" /></section>
      <section className="panel event-list-panel"><div className="panel-heading"><div><span>Басқарылатын іс-шаралар</span><h2>{items.length} жазба</h2></div><a href="/events" target="_blank" rel="noreferrer">Ашық күнтізбе</a></div>
        <div className="event-admin-list">{items.map((item) => <a href={`/dashboard/events/${item.id}`} key={item.id}>
          <span className="event-list-date"><CalendarDays size={16} /><strong>{formatDate(item.startAt.toISOString())}</strong></span>
          <span><strong>{item.title}</strong><small>{eventScopeLabel(item.eventScope)} · {item.branch?.regionName ?? item.regionName ?? "Республика"}</small></span>
          <span className={`content-status ${item.status.toLowerCase()}`}>{eventStatusLabel(item.status)}</span>
        </a>)}{items.length === 0 && <p className="empty-content">Бұл сүзгіге сәйкес іс-шара жоқ.</p>}</div>
      </section>
    </div>
  </main>;
}
