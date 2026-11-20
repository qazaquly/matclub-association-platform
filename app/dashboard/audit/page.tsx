import { Activity, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { listAuditLogs } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canViewAudit } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

function jsonSummary(value: string | null) {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
}

type AuditSearch = { q?: string; from?: string; to?: string; page?: string };

function dayStart(day?: string) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(day + "T00:00:00+05:00");
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditSearch> }) {
  const user = (await getCurrentUser())!;
  if (!canViewAudit(user)) notFound();
  const state = await searchParams;
  const q = state.q?.trim().slice(0, 160);
  const requested = Number(state.page);
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 1000000 ? requested : 1;
  const size = 50;
  const lastDay = dayStart(state.to);
  const rows = await listAuditLogs(size + 1, { q, from: dayStart(state.from),
    until: lastDay && new Date(lastDay.getTime() + 86400000), skip: (page - 1) * size });
  const logs = rows.slice(0, size);
  function pageHref(number: number) {
    const query = new URLSearchParams({ page: String(number) });
    if (q) query.set("q", q);
    if (state.from) query.set("from", state.from);
    if (state.to) query.set("to", state.to);
    return "?" + query;
  }
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Институционалдық бақылау</p><h1>Өзгермейтін аудит журналы</h1></div><span className="immutable-pill"><LockKeyhole size={15} /> Өңдеуге және өшіруге жабық</span></div><div className="audit-explainer"><Activity size={22} /><p>Әр әкімшілік әрекет орындаушы, нақты уақыт, нысан, алдыңғы және жаңа мәндермен бірге сақталады. Дерекқор триггерлері жазбаларды өзгертуге немесе өшіруге жол бермейді.</p></div>
    <form className="event-filter" method="get"><label>Орындаушы, әрекет немесе нысан<input name="q" type="search" maxLength={160} defaultValue={q} /></label><label>Бастап<input name="from" type="date" defaultValue={state.from} max={state.to || undefined} /></label><label>Дейін<input name="to" type="date" defaultValue={state.to} min={state.from || undefined} /></label><button className="button">Іздеу</button>{(q || state.from || state.to) && <a href="/dashboard/audit">Тазарту</a>}</form>
    <section className="panel"><div className="table-wrap"><table className="data-table audit-table"><thead><tr><th>Уақыт / орындаушы</th><th>Әрекет</th><th>Нысан</th><th>Өзгеріс</th><th>Себеп</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{formatDate(log.createdAt, true)}</strong><small>{log.actorName ?? "Жүйе"}<br />{log.ipAddress ?? "—"}</small></td><td><code>{log.actionType}</code></td><td><span>{log.targetEntity}</span><small>{log.targetEntityId}</small></td><td><details><summary>Мәндерді көру</summary><strong>Алдыңғы мән</strong><code className="json-cell">{jsonSummary(log.previousValue)}</code><strong>Жаңа мән</strong><code className="json-cell">{jsonSummary(log.newValue)}</code></details></td><td>{log.reason ?? "—"}</td></tr>)}</tbody></table></div>{!logs.length && <p className="empty-content">Бұл бетте жазба табылмады.</p>}</section>
    <nav className="task-links" aria-label="Журнал беттері">{page > 1 && <a href={pageHref(page - 1)}>Алдыңғы бет</a>}<span>{page}-бет</span>{rows.length > size && <a href={pageHref(page + 1)}>Келесі бет</a>}</nav></main>;
}
