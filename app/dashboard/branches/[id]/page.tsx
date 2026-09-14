import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CalendarDays, ClipboardList,
  FileText, MapPin, Target, UserCheck, Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getBranchWorkspace } from "@/db/branch-workspace";
import { getCurrentUser } from "@/lib/auth";
import { eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { institutionalDocumentTypeLabel } from "@/lib/institutional-documents";
import { projectDocumentCategoryLabel, projectStatusLabel } from "@/lib/projects";

const number = new Intl.NumberFormat("kk-KZ");

export default async function BranchWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const actor = (await getCurrentUser())!;
  const [{ id }, state] = await Promise.all([params, searchParams]);
  const data = await getBranchWorkspace(actor, id, state.from, state.to);
  if (!data) notFound();

  const { branch, report } = data;
  const branchQuery = encodeURIComponent(branch.id);
  const memberCount = data.membershipCounts.member ?? 0;
  const applicantCount = data.membershipCounts.applicant ?? 0;
  const reserveCount = data.membershipCounts.reserve ?? 0;
  const openApplications = (data.applicationCounts.registered_user ?? 0) + (data.applicationCounts.applicant ?? 0);
  const activeEvents = (data.eventCounts.DRAFT ?? 0) + (data.eventCounts.SUBMITTED ?? 0) + (data.eventCounts.PUBLISHED ?? 0) + (data.eventCounts.POSTPONED ?? 0);
  const activeProjects = (data.projectCounts.PLANNED ?? 0) + (data.projectCounts.ACTIVE ?? 0) + (data.projectCounts.PAUSED ?? 0);

  return <main className="dashboard-content branch-workspace">
    <Link className="workspace-back" href="/dashboard/branches"><ArrowLeft size={15} /> Филиалдар тізімі</Link>
    <div className="dash-page-heading branch-workspace-heading">
      <div><p>Филиалдың жұмыс кабинеті</p><h1>{branch.name}</h1><span><MapPin size={14} /> {branch.regionName}</span></div>
      <StatusBadge status={branch.status} />
    </div>

    <nav className="workspace-nav" aria-label="Кабинет бөлімдері">
      <a href="#overview">Шолу</a><a href="#members">Мүшелер</a><a href="#applications">Өтініштер</a>
      <a href="#events">Іс-шаралар</a><a href="#projects">Жобалар</a><a href="#documents">Құжаттар</a><a href="#report">Кезеңдік есеп</a>
    </nav>

    <section className="workspace-summary" id="overview">
      <article><span><Users size={18} /></span><div><small>Толық мүшелер</small><strong>{number.format(memberCount)}</strong></div><a href={`/dashboard/members?branchId=${branchQuery}&membershipStatus=member`}>Ашу</a></article>
      <article><span><ClipboardList size={18} /></span><div><small>Жаңа және үміткер</small><strong>{number.format(openApplications)}</strong></div><a href={`/dashboard/applications?branchId=${branchQuery}`}>Ашу</a></article>
      <article><span><CalendarDays size={18} /></span><div><small>Белсенді іс-шара</small><strong>{number.format(activeEvents)}</strong></div><a href={`/dashboard/events?scope=BRANCH&branchId=${branchQuery}`}>Ашу</a></article>
      <article><span><BriefcaseBusiness size={18} /></span><div><small>Белсенді жоба</small><strong>{number.format(activeProjects)}</strong></div><a href={`/dashboard/projects?scope=BRANCH&branchId=${branchQuery}`}>Ашу</a></article>
    </section>

    <section className="workspace-leadership panel">
      <div><span className="workspace-icon"><Building2 size={19} /></span><div><small>Филиал директоры</small><strong>{branch.director?.fullName ?? "Тағайындалмаған"}</strong></div></div>
      <div><small>Филиал қызметкерлері</small><strong>{branch.staff.length}</strong><span>{branch.staff.map((item) => item.person?.fullName).filter(Boolean).join(", ") || "Белсенді қызметкер жоқ"}</span></div>
    </section>

    <div className="workspace-columns">
      <section className="panel workspace-section" id="members">
        <div className="panel-heading"><div><span>Адамдар</span><h2><Users size={18} /> Мүшелер</h2></div><a href={`/dashboard/members?branchId=${branchQuery}`}>Барлығы <ArrowRight size={14} /></a></div>
        <div className="workspace-breakdown"><a href={`/dashboard/members?branchId=${branchQuery}`}><strong>{memberCount}</strong><span>Мақұлданған мүше</span></a><a href={`/dashboard/applications?branchId=${branchQuery}`}><strong>{applicantCount}</strong><span>Үміткерлер өтініште</span></a><span><strong>{reserveCount}</strong><span>Резерв</span></span></div>
        <div className="workspace-list">{data.recentMembers.map((item) => <a href={`/dashboard/members/${item.id}`} key={item.id}><div><strong>{item.fullName}</strong><small>{item.workplace ?? item.position ?? "Жұмыс орны көрсетілмеген"}</small></div><StatusBadge status={item.membershipStatus} /></a>)}{data.recentMembers.length === 0 && <p className="empty-content">Филиалда мақұлданған мүше жоқ.</p>}</div>
      </section>

      <section className="panel workspace-section" id="applications">
        <div className="panel-heading"><div><span>Мүшелік процесі</span><h2><ClipboardList size={18} /> Өтініштер</h2></div><a href={`/dashboard/applications?branchId=${branchQuery}`}>Барлығы <ArrowRight size={14} /></a></div>
        <div className="workspace-list">{data.recentApplications.map((item) => {
          const application = item.applications[0];
          const href = application ? `/dashboard/applications/${application.id}` : `/dashboard/members/${item.id}`;
          return <a href={href} key={item.id}><div><strong>{item.fullName}</strong><small>{formatDate((application?.submittedAt ?? item.createdAt).toISOString())} · {item.workplace ?? "Жұмыс орны көрсетілмеген"}</small></div><StatusBadge status={item.membershipStatus} /></a>;
        })}{data.recentApplications.length === 0 && <p className="empty-content">Жаңа тіркелгі немесе үміткер жоқ.</p>}</div>
      </section>

      <section className="panel workspace-section" id="events">
        <div className="panel-heading"><div><span>Филиал күнтізбесі</span><h2><CalendarDays size={18} /> Іс-шаралар</h2></div><a href={`/dashboard/events?scope=BRANCH&branchId=${branchQuery}`}>Барлығы <ArrowRight size={14} /></a></div>
        <div className="workspace-list">{data.recentEvents.map((item) => <a href={`/dashboard/events/${item.id}`} key={item.id}><div><strong>{item.title}</strong><small>{formatDate(item.startAt.toISOString())} · {item._count.registrations} тіркелген{item.result?.participantCount != null ? ` · ${item.result.participantCount} нәтиже` : ""}</small></div><i className={`content-status ${item.status.toLowerCase()}`}>{eventStatusLabel(item.status)}</i></a>)}{data.recentEvents.length === 0 && <p className="empty-content">Филиалдық іс-шара жоқ.</p>}</div>
      </section>

      <section className="panel workspace-section" id="projects">
        <div className="panel-heading"><div><span>Жұмыс портфелі</span><h2><BriefcaseBusiness size={18} /> Жобалар</h2></div><a href={`/dashboard/projects?scope=BRANCH&branchId=${branchQuery}`}>Барлығы <ArrowRight size={14} /></a></div>
        <div className="workspace-list">{data.recentProjects.map((item) => <a href={`/dashboard/projects/${item.id}`} key={item.id}><div><strong>{item.title}</strong><small>{formatDate(item.startDate.toISOString())} · {item._count.participants} қатысушы · {item._count.stages} кезең{item.result?.beneficiaryCount != null ? ` · ${item.result.beneficiaryCount} қамтылды` : ""}</small></div><i className={`project-status ${item.status.toLowerCase()}`}>{projectStatusLabel(item.status)}</i></a>)}{data.recentProjects.length === 0 && <p className="empty-content">Филиалдық жоба жоқ.</p>}</div>
      </section>
    </div>

    <section className="panel workspace-section workspace-documents" id="documents">
      <div className="panel-heading"><div><span>Бір жерден қол жеткізу</span><h2><FileText size={18} /> Құжаттар</h2></div></div>
      <div className="workspace-document-columns">
        <div><h3>Өтініш құжаттары</h3>{data.recentApplicationDocuments.map((item) => <a href={`/api/documents/${item.id}`} key={item.id}><FileText size={15} /><span><strong>{item.originalName}</strong><small>{item.owner.fullName} · {Math.ceil(item.sizeBytes / 1024)} КБ</small></span><ArrowRight size={14} /></a>)}{data.recentApplicationDocuments.length === 0 && <p className="empty-content">Құжат жоқ.</p>}</div>
        <div><h3>Жоба құжаттары</h3>{data.projectDocumentAccess ? data.recentProjectDocuments.map((item) => <a href={`/api/projects/${item.projectId}/documents/${item.id}`} key={item.id}><FileText size={15} /><span><strong>{item.originalName}</strong><small>{item.project.title} · {projectDocumentCategoryLabel(item.category)}</small></span><ArrowRight size={14} /></a>) : <p className="workspace-restricted">Жоба құжаттары тек арнайы құқығы бар қызметкерге көрсетіледі.</p>}{data.projectDocumentAccess && data.recentProjectDocuments.length === 0 && <p className="empty-content">Жоба құжаты жоқ.</p>}</div>
        <div><h3>Ресми құжаттар</h3>{data.recentInstitutionalDocuments.map((item) => <a href={`/dashboard/documents/${item.id}`} key={item.id}><FileText size={15} /><span><strong>{item.title}</strong><small>№ {item.documentNumber} · {institutionalDocumentTypeLabel(item.documentType)}</small></span><ArrowRight size={14} /></a>)}{data.recentInstitutionalDocuments.length === 0 && <p className="empty-content">Филиалдың ресми құжаты жоқ.</p>}</div>
      </div>
    </section>

    <section className="panel workspace-report" id="report">
      <div className="panel-heading"><div><span>Басқарушылық шолу</span><h2><Target size={18} /> Кезеңдік есеп</h2></div><small>{formatDate(`${data.period.from}T00:00:00Z`)} — {formatDate(`${data.period.to}T00:00:00Z`)}</small></div>
      <form method="get" className="workspace-period-form"><label>Басталуы<input type="date" name="from" defaultValue={data.period.from} /></label><label>Аяқталуы<input type="date" name="to" defaultValue={data.period.to} /></label><button className="button" type="submit">Есепті жаңарту</button></form>
      <div className="workspace-report-grid">
        <article><Users size={17} /><strong>{report.joinedMembers}</strong><span>Жаңа мүше</span></article>
        <article><ClipboardList size={17} /><strong>{report.submittedApplications}</strong><span>Өтініш түсті</span><small>{report.approvedApplications} мақұлданды</small></article>
        <article><CalendarDays size={17} /><strong>{report.completedEvents}</strong><span>Іс-шара аяқталды</span><small>{report.eventResultCount} қорытынды</small></article>
        <article><UserCheck size={17} /><strong>{report.eventAttendance}</strong><span>Нақты қатысты</span><small>{report.eventRegistrations} тіркелді</small></article>
        <article><BriefcaseBusiness size={17} /><strong>{report.completedProjects}</strong><span>Жоба аяқталды</span><small>{report.projectResultCount} нәтиже</small></article>
        <article><Target size={17} /><strong>{number.format(report.beneficiaries)}</strong><span>Қамтылған адам</span></article>
      </div>
    </section>
  </main>;
}
