/* eslint-disable @next/next/no-img-element -- Database-backed media require native elements here. */
import { ArrowRight, CalendarDays, List, MapPin } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { listPublicEvents } from "@/db/events";
import { eventFormatLabel, eventLocation, eventScopeLabel, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function almatyDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function monthKey(value: Date) {
  return almatyDateKey(value).slice(0, 7);
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string; period?: string; region?: string; month?: string }> }) {
  const [items, state] = await Promise.all([listPublicEvents(), searchParams]);
  const now = new Date();
  const view = state.view === "calendar" ? "calendar" : "list";
  const period = ["upcoming", "past", "all"].includes(state.period ?? "") ? state.period! : "upcoming";
  const regions = [...new Set(items.map((item) => item.branch?.regionName ?? item.regionName).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "kk"));
  const filtered = items.filter((item) => {
    if (state.region && (item.branch?.regionName ?? item.regionName) !== state.region) return false;
    if (period === "upcoming") return item.endAt >= now && item.status !== "COMPLETED";
    if (period === "past") return item.endAt < now || item.status === "COMPLETED";
    return true;
  });
  const selectedMonth = /^\d{4}-\d{2}$/.test(state.month ?? "") ? state.month! : monthKey(now);
  const [year, month] = selectedMonth.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDay = new Date(`${selectedMonth}-01T12:00:00+05:00`).getUTCDay();
  const mondayOffset = (firstDay + 6) % 7;
  const monthItems = filtered.filter((item) => monthKey(item.startAt) === selectedMonth);

  return <PublicShell><main>
    <section className="page-hero"><div className="container narrow"><p className="eyebrow">Іс-шаралар</p><h1>Бір күнтізбе — біртұтас институционалдық тарих</h1><p>Республикалық және филиалдық кездесулер, кәсіби талқылаулар мен бірлестік шаралары.</p></div></section>
    <section className="section container events-public-section">
      <form className="events-public-filter" method="get">
        <label>Кезең<select name="period" defaultValue={period}><option value="upcoming">Алдағы</option><option value="past">Өткен</option><option value="all">Барлығы</option></select></label>
        <label>Өңір<select name="region" defaultValue={state.region ?? ""}><option value="">Барлық өңір</option>{regions.map((region) => <option value={region} key={region}>{region}</option>)}</select></label>
        <label>Көрініс<select name="view" defaultValue={view}><option value="list">Тізім</option><option value="calendar">Күнтізбе</option></select></label>
        {view === "calendar" && <label>Ай<input name="month" type="month" defaultValue={selectedMonth} /></label>}
        <button className="button button-primary" type="submit">Көрсету</button>
      </form>

      {view === "calendar" ? <div className="event-calendar" aria-label={`${selectedMonth} іс-шаралар күнтізбесі`}>
        <div className="calendar-weekdays">{["Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жс"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{Array.from({ length: mondayOffset }, (_, index) => <span className="calendar-day empty" key={`empty-${index}`} />)}{Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
          const dayEvents = monthItems.filter((item) => almatyDateKey(item.startAt) === key);
          return <span className={`calendar-day ${dayEvents.length ? "has-events" : ""}`} key={key}><b>{day}</b>{dayEvents.map((item) => <a href={`/events/${item.slug}`} key={item.id}>{item.title}<small>{eventStatusLabel(item.status)}</small></a>)}</span>;
        })}</div>
      </div> : <div className="event-public-list">{filtered.map((item) => <article className="event-public-card" key={item.id}>
        {item.coverMediaId && <img src={`/api/public-media/${item.coverMediaId}`} alt="" />}
        <div className="event-public-date"><CalendarDays size={18} /><span><strong>{formatDate(item.startAt.toISOString())}</strong><small>{formatDate(item.startAt.toISOString(), true).split(", ")[1]}</small></span></div>
        <div className="event-public-copy"><div className="event-meta-row"><span>{eventScopeLabel(item.eventScope)}</span><span>{eventFormatLabel(item.eventFormat)}</span>{item.status !== "PUBLISHED" && <span className={`event-public-status ${item.status.toLowerCase()}`}>{eventStatusLabel(item.status)}</span>}</div><h2>{item.title}</h2><p>{item.summary}</p><small><MapPin size={13} /> {eventLocation(item)}</small></div>
        <a className="event-public-link" href={`/events/${item.slug}`}>Толық ақпарат <ArrowRight size={16} /></a>
      </article>)}{filtered.length === 0 && <div className="public-empty-state"><CalendarDays size={28} /><h2>Бұл сүзгіге сәйкес іс-шара жоқ</h2><p>Басқа кезеңді немесе өңірді таңдаңыз.</p></div>}</div>}
      <div className="event-view-note">{view === "calendar" ? <CalendarDays size={16} /> : <List size={16} />} Тек жарияланған іс-шаралар көрсетіледі.</div>
    </section>
  </main></PublicShell>;
}
