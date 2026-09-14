/* eslint-disable @next/next/no-html-link-for-pages -- vinext dashboard transitions require native navigation. */
import { ArrowRight, Building2, CircleUserRound, ClipboardCheck, Clock3, UserCheck, UserRoundX, UsersRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications, isDepartmentAccess, isFullAccess } from "@/lib/authorization";
import { getDashboardMetrics, getOwnProfile, listApplicationCandidates, listAuditLogs, listBranches } from "@/db/queries";
import { formatDate, statusLabel } from "@/lib/format";
import { StatusBadge } from "@/app/components/StatusBadge";

const metricIcons = [UsersRound, CircleUserRound, Clock3, ClipboardCheck, UserCheck, UserRoundX];

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user) && !isDepartmentAccess(user)) {
    const profile = await getOwnProfile(user);
    return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Қош келдіңіз</p><h1>{user.fullName}</h1></div><StatusBadge status={user.membershipStatus} /></div><section className="member-welcome"><div><span>Мүшелік профилі</span><h2>Сіздің институционалдық жазбаңыз</h2><p>Жеке деректерді өзіңіз жаңарта аласыз. Ресми мәртебе, мүшелік күні және филиал жүйе арқылы басқарылады.</p><a className="button button-primary" href="/dashboard/profile">Профильді ашу <ArrowRight size={17} /></a></div><dl><div><dt>Мәртебе</dt><dd>{statusLabel(user.membershipStatus)}</dd></div><div><dt>Филиал</dt><dd>{String(profile?.branchName ?? "—")}</dd></div><div><dt>Мүше болған күн</dt><dd>{formatDate(String(profile?.membership_started_at ?? ""))}</dd></div></dl></section></main>;
  }
  if (isDepartmentAccess(user) && !isFullAccess(user)) {
    return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Кәсіби бағыт</p><h1>Департамент кеңістігі</h1></div><span className="environment-pill">B деңгейі</span></div><section className="department-welcome"><BookOpenPanel /><div><h2>Мақсатқа сай шектеулі қолжетімділік</h2><p>Бұл кеңістікте кәсіби міндеттерге қажет аты-жөн, жұмыс орны, лауазым және математикалық мамандану ғана көрсетіледі. Байланыс деректері, ішкі филиал жазбалары және әкімшілік аудит қолжетімсіз.</p><a className="button button-primary" href="/dashboard/professional">Кәсіби тізімді ашу <ArrowRight size={17} /></a></div></section></main>;
  }
  const [metrics, applications, branches, audit] = await Promise.all([
    getDashboardMetrics(user), listApplicationCandidates(user, 6), listBranches(user), isFullAccess(user) ? listAuditLogs(5) : Promise.resolve([]),
  ]);
  const values = [metrics.registeredUsers, metrics.applicants, metrics.awaitingReview, metrics.reserve, metrics.members, metrics.rejected];
  const labels = ["Тіркелген профиль", "Үміткер", "Қаралуда", "Резерв", "Мүше", "Қабылданбаған өтініш"];
  const destinations = [
    "/dashboard/applications?status=registered_user",
    "/dashboard/applications?status=applicant",
    "/dashboard/applications?status=applicant",
    "/dashboard/reports",
    "/dashboard/members",
    "/dashboard/reports",
  ];
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Операциялық шолу</p><h1>Бірлестік панелі</h1></div><span className="updated-at">Жаңартылды · {formatDate(new Date().toISOString(), true)}</span></div><section className="metrics-grid">{values.map((value, index) => { const Icon = metricIcons[index]; return <a className="metric-card" href={destinations[index]} key={labels[index]} aria-label={`${labels[index]} тізімін ашу`}><div><span>{labels[index]}</span><strong>{value}</strong></div><Icon size={22} /></a>; })}</section><div className="dashboard-grid"><section className="panel wide"><div className="panel-heading"><div><span>Мүшелік</span><h2>Соңғы тіркелгілер мен үміткерлер</h2></div><a href="/dashboard/applications">Барлығын көру <ArrowRight size={16} /></a></div><div className="table-wrap"><table><thead><tr><th>Адам</th><th>Филиал</th><th>Күні</th><th>Мәртебе</th></tr></thead><tbody>{applications.map((application) => {
    const href = application.applicationId ? `/dashboard/applications/${application.applicationId}` : `/dashboard/members/${application.personId}`;
    return <tr key={application.personId}><td><a href={href}><strong>{application.fullName}</strong><small>{application.position ?? application.email}</small></a></td><td>{application.branchId ? <a href={`/dashboard/applications?branchId=${encodeURIComponent(application.branchId)}`}>{application.branchName}</a> : "—"}</td><td>{formatDate(application.activityAt)}</td><td><StatusBadge status={application.membershipStatus} /></td></tr>;
  })}</tbody></table></div></section><section className="panel"><div className="panel-heading"><div><span>Өңірлер</span><h2>Филиалдар</h2></div><a href="/dashboard/branches">Ашу</a></div><div className="branch-mini-list">{branches.slice(0, 5).map((branch) => <a href={`/dashboard/branches/${encodeURIComponent(branch.id)}`} key={branch.id}><span><Building2 size={16} /></span><div><strong>{branch.regionName}</strong><small>{branch.memberCount} мүше · {branch.applicantCount} үміткер</small></div></a>)}</div></section>{isFullAccess(user) && <section className="panel audit-panel"><div className="panel-heading"><div><span>Бақылау</span><h2>Соңғы аудит әрекеттері</h2></div><a href="/dashboard/audit">Журнал</a></div><div className="audit-mini-list">{audit.map((event) => <div key={event.id}><i /><div><strong>{event.actionType}</strong><small>{event.actorName ?? "Жүйе"} · {formatDate(event.createdAt, true)}</small></div></div>)}</div></section>}</div></main>;
}

function BookOpenPanel() { return <div className="department-mark" aria-hidden="true"><span>π</span><i>x² + y²</i></div>; }
