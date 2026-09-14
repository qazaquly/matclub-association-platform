import { Activity, CalendarCheck2, CheckCircle2, FolderKanban, MapPinned, TrendingDown, TrendingUp, UserCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canViewReports, isFullAccess } from "@/lib/authorization";
import { getManagementAnalytics } from "@/db/analytics";
import { listBranches } from "@/db/queries";

function Metric({ label, value, note, change, icon: Icon }: { label: string; value: string | number; note: string; change?: number; icon: typeof UsersRound }) {
  return <article className="analytics-metric"><span><Icon size={19} /></span><div><small>{label}</small><strong>{typeof value === "number" ? value.toLocaleString("kk-KZ") : value}</strong><p>{note}</p></div>{change !== undefined && <em className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{change > 0 ? "+" : ""}{change}%</em>}</article>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ branchId?: string; from?: string; to?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canViewReports(actor)) notFound();
  const state = await searchParams;
  const [analytics, branches] = await Promise.all([
    getManagementAnalytics(actor, state.branchId || undefined, state.from, state.to),
    listBranches(actor),
  ]);
  const { metrics, period, months, membership, categories, branches: branchRows, attention } = analytics;
  const activityMax = Math.max(1, ...months.flatMap((month) => [month.members, month.events, month.projects]));
  const statusMax = Math.max(1, ...membership.map((item) => item.value));
  const categoryMax = Math.max(1, ...categories.map((item) => item.value));

  return <main className="dashboard-content analytics-page">
    <div className="dash-page-heading"><div><p>Нақты дерекке негізделген шолу</p><h1>Басқару көрсеткіштері</h1></div><span className="record-count">{period.from} — {period.to}</span></div>
    <form className="analytics-filter" method="get">
      <label>Өңір<select name="branchId" defaultValue={state.branchId ?? ""}><option value="">Барлық рұқсат етілген өңір</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select></label>
      <label>Басталған күні<input type="date" name="from" defaultValue={period.from} /></label>
      <label>Аяқталған күні<input type="date" name="to" defaultValue={period.to} /></label>
      <button type="submit">Көрсеткіштерді жаңарту</button>
    </form>

    <section className="analytics-metrics">
      <Metric label="Қазіргі мүшелер" value={metrics.memberCount} note={`Кезеңде +${metrics.joinedMembers} жаңа мүше`} change={metrics.joinedChange} icon={UsersRound} />
      <Metric label="Өтініштер" value={metrics.submittedApplications} note={`${metrics.pendingApplications} өтініш қаралуда`} icon={UserCheck} />
      <Metric label="Мақұлдау үлесі" value={`${metrics.approvalRate}%`} note={`${metrics.reviewedApplications} шешімнің ішінде`} icon={CheckCircle2} />
      <Metric label="Аяқталған іс-шара" value={metrics.completedEvents} note={`${metrics.registrations} тіркелу`} change={metrics.eventChange} icon={CalendarCheck2} />
      <Metric label="Нақты қатысу" value={`${metrics.attendanceRate}%`} note={`${metrics.attendancePresent} адам қатысты`} icon={Activity} />
      <Metric label="Аяқталған жоба" value={metrics.completedProjects} note={`${metrics.activeProjects} жоба қазір жүріп жатыр`} change={metrics.projectChange} icon={FolderKanban} />
      <Metric label="Жоба қатысушылары" value={metrics.projectParticipants} note="Белсенді және аяқтаған қатысушылар" icon={UserCheck} />
      <Metric label="Жобамен қамтылғандар" value={metrics.beneficiaries} note="Қорытынды есептердегі жиынтық" icon={MapPinned} />
    </section>

    <section className="analytics-grid">
      <article className="panel analytics-activity-panel">
        <div className="panel-heading"><div><p>Айлық қозғалыс</p><h2>Мүше, іс-шара және жоба динамикасы</h2></div><div className="analytics-legend"><span className="members">Жаңа мүше</span><span className="events">Іс-шара</span><span className="projects">Жоба</span></div></div>
        <div className="analytics-bars">{months.map((month) => <div className="analytics-month" key={month.key}><div><i className="members" title={`${month.members} жаңа мүше`} style={{ height: `${Math.max(month.members ? 6 : 0, month.members / activityMax * 100)}%` }} /><i className="events" title={`${month.events} іс-шара`} style={{ height: `${Math.max(month.events ? 6 : 0, month.events / activityMax * 100)}%` }} /><i className="projects" title={`${month.projects} жоба`} style={{ height: `${Math.max(month.projects ? 6 : 0, month.projects / activityMax * 100)}%` }} /></div><small>{month.label}</small></div>)}</div>
      </article>
      <article className="panel analytics-attention">
        <div className="panel-heading"><div><p>Басқару назары</p><h2>Қозғалыссыз бағыттар</h2></div></div>
        <div><span><strong>{attention.branchesWithoutNewMembers}</strong><small>жаңа мүшесі жоқ өңір</small></span><span><strong>{attention.branchesWithoutEvents}</strong><small>аяқталған шарасы жоқ өңір</small></span><span><strong>{attention.branchesWithoutProjects}</strong><small>аяқталған жобасы жоқ өңір</small></span></div>
        <p>Сандар таңдалған кезең мен рұқсат етілген өңірлерге ғана есептеледі.</p>
      </article>
    </section>

    <section className="analytics-grid distributions">
      <article className="panel analytics-distribution"><div className="panel-heading"><div><p>Құрам</p><h2>Мүшелік мәртебелері</h2></div></div><div>{membership.map((item) => <span key={item.label}><label>{item.label}<b>{item.value}</b></label><i><em style={{ width: `${item.value / statusMax * 100}%` }} /></i></span>)}</div></article>
      <article className="panel analytics-distribution"><div className="panel-heading"><div><p>Кәсіби құрам</p><h2>Санаттар бойынша</h2></div></div><div>{categories.length ? categories.map((item) => <span key={item.label}><label>{item.label}<b>{item.value}</b></label><i><em style={{ width: `${item.value / categoryMax * 100}%` }} /></i></span>) : <p className="analytics-empty">Кәсіби санаттар тағайындалмаған.</p>}</div></article>
    </section>

    <section className="panel analytics-branches">
      <div className="panel-heading"><div><p>{isFullAccess(actor) && !state.branchId ? "Өңірлер салыстыруы" : "Өңір нәтижесі"}</p><h2>Филиал белсенділігі</h2></div><Link href="/dashboard/reports">Толық есептерге өту</Link></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Өңір</th><th>Мүше</th><th>Жаңа мүше</th><th>Іс-шара</th><th>Тіркелген / қатысқан</th><th>Жоба</th><th>Жоба қатысушысы</th><th>Қамту</th></tr></thead><tbody>{branchRows.map((row) => <tr key={row.id}><td><Link href={`/dashboard/branches/${row.id}`}><strong>{row.name}</strong></Link></td><td>{row.members}</td><td>{row.joined}</td><td>{row.events}</td><td>{row.registrations} / {row.attendance}</td><td>{row.projects}</td><td>{row.projectParticipants}</td><td>{row.beneficiaries}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
