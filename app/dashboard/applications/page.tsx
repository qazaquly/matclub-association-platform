import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listApplicationCandidates } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

const statuses = [
  ["", "Барлық мәртебе"],
  ["registered_user", "Жаңадан тіркелген"],
  ["applicant", "Үміткер"],
] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; branchId?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const state = await searchParams;
  const status: "" | "registered_user" | "applicant" = state.status === "registered_user" || state.status === "applicant" ? state.status : "";
  const applications = await listApplicationCandidates(user, 500, { membershipStatus: status || undefined, branchId: state.branchId || undefined });
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Мүшелік процесі</p><h1>Өтініштер</h1></div><span className="record-count">{applications.length} жазба</span></div><form className="filter-bar" method="get"><div><Search size={17} /><label>Мәртебе <select name="status" defaultValue={status}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{state.branchId && <input type="hidden" name="branchId" value={state.branchId} />}<button type="submit">Сүзу</button></div><span><ClipboardList size={17} /> Тек жаңа тіркелгілер мен үміткерлер</span></form><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Адам</th><th>Қала / аудан</th><th>Филиал</th><th>Тіркелген / жіберілген</th><th>Мәртебе</th><th /></tr></thead><tbody>{applications.map((application) => {
    const href = application.applicationId ? `/dashboard/applications/${application.applicationId}` : `/dashboard/members/${application.personId}`;
    return <tr key={application.personId}><td><a className="table-person-link" href={href}><strong>{application.fullName}</strong><small>{application.workplace ? `${application.workplace} · ${application.email}` : application.email}</small></a></td><td>{application.cityDistrict || "—"}</td><td>{application.branchId ? <a href={`/dashboard/applications?branchId=${encodeURIComponent(application.branchId)}`}>{application.branchName}</a> : "—"}</td><td>{formatDate(application.activityAt)}</td><td><StatusBadge status={application.membershipStatus} /></td><td><a className="row-action" href={href}>Ашу <ArrowRight size={15} /></a></td></tr>;
  })}</tbody></table>{applications.length === 0 && <div className="empty-state"><ClipboardList size={28} /><h2>Өтініш жоқ</h2><p>Жауапкершілік аумағыңызда жаңа тіркелгі немесе үміткер табылмады.</p></div>}</div></section></main>;
}
