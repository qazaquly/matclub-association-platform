/* eslint-disable @next/next/no-html-link-for-pages -- dashboard filters use native navigation. */
import { ArrowRight, ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listApplicationCandidates, listApplications, listBranches } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

const pageSize = 50;
type Filters = { status?: string; branchId?: string; q?: string; page?: string };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const state = await searchParams;
  const status = state.status === "registered_user" || state.status === "applicant" || state.status === "awaiting_review" ? state.status : "";
  const query = state.q?.trim().slice(0, 120) || "";
  const branchId = state.branchId || "";
  const page = Math.max(1, Math.min(1000000, Math.floor(Number(state.page)) || 1));
  const filters = { branchId, query, offset: (page - 1) * pageSize };
  const rows = status === "awaiting_review"
    ? listApplications(user, pageSize + 1, { ...filters, status }).then(items => items.map(item => ({
        ...item, href: "/dashboard/applications/" + item.id, activityAt: item.submittedAt,
      })))
    : listApplicationCandidates(user, pageSize + 1, { ...filters, membershipStatus: status || undefined }).then(items => items.map(application => {
        const href = application.applicationId ? "/dashboard/applications/" + application.applicationId : "/dashboard/members/" + application.personId;
        return { ...application, href, status: application.membershipStatus };
      }));
  const [results, branches] = await Promise.all([rows, listBranches(user)]);
  const shown = results.slice(0, pageSize);
  function listUrl(nextPage: number, region = branchId) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (region) params.set("branchId", region);
    if (nextPage > 1) params.set("page", String(nextPage));
    return "/dashboard/applications" + (params.size ? "?" + params.toString() : "");
  }
  return <main className="dashboard-content">
    <div className="dash-page-heading"><h1>Өтініштер</h1>
      {shown.length > 0 && <span className="record-count">{filters.offset + 1}–{filters.offset + shown.length} жазба</span>}
    </div>
    <form className="member-search application-search" method="get">
      <label>Аты-жөні немесе электрондық пошта<input name="q" type="search" defaultValue={query} maxLength={120} /></label>
      <label>Мәртебе<select name="status" defaultValue={status}>
        <option value="">Тіркелгендер мен үміткерлер</option><option value="registered_user">Жаңадан тіркелген</option>
        <option value="applicant">Үміткер</option><option value="awaiting_review">Қаралуда</option>
      </select></label>
      <label>Филиал<select name="branchId" defaultValue={branchId}><option value="">Барлық қолжетімді филиал</option>
        {branches.map(b => <option key={b.id} value={b.id}>{b.regionName}</option>)}</select></label>
      <div className="member-search-actions"><button type="submit">Іздеу</button>{(status || query || branchId) && <a href="/dashboard/applications">Тазарту</a>}</div>
    </form>
    <section className="panel"><div className="table-wrap"><table className="data-table application-table">
      <thead><tr><th>Адам</th><th>Қала / аудан</th><th>Филиал</th><th>Тіркелген / жіберілген</th><th>Мәртебе</th><th aria-label="Әрекет" /></tr></thead>
      <tbody>{shown.map(row => <tr key={row.href}>
        <td><a className="table-person-link" href={row.href}><strong>{row.fullName}</strong><small>{row.workplace ? row.workplace + " · " : ""}{row.email}</small></a></td>
        <td>{row.cityDistrict || "—"}</td><td>{row.branchId ? <a href={listUrl(1, row.branchId)}>{row.branchName}</a> : "—"}</td>
        <td>{formatDate(row.activityAt)}</td><td><StatusBadge status={row.status} /></td>
        <td><a className="row-action" href={row.href}>Ашу <ArrowRight size={15} /></a></td>
      </tr>)}</tbody>
    </table></div>
    {!shown.length && <div className="empty-state"><ClipboardList size={28} /><h2>Жазба табылмады</h2>
      {(query || status || branchId || page > 1) && <a href="/dashboard/applications">Барлық жазбаны көру</a>}</div>}
    </section>
    {(page > 1 || results.length > pageSize) && <nav className="list-pages" aria-label="Өтініштер беттері">
      {page > 1 && <a href={listUrl(page - 1)}>Алдыңғы бет</a>}<span>{page}-бет</span>
      {results.length > pageSize && <a href={listUrl(page + 1)}>Келесі бет</a>}</nav>}
  </main>;
}
