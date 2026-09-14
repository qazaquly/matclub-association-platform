/* eslint-disable @next/next/no-html-link-for-pages -- vinext dashboard transitions require native navigation. */
import { Archive, ArrowLeft, CalendarCheck, Download, FileText, History, Trash2, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getMemberDetail } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications, isFullAccess } from "@/lib/authorization";
import { formatDate, statusLabel } from "@/lib/format";
import { educationLevels } from "@/lib/membership-application";

export default async function MemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const [{ id }, state] = await Promise.all([params, searchParams]);
  const member = await getMemberDetail(user, id);
  if (!member) notFound();
  const educationLevel = educationLevels.find(([code]) => code === member.educationLevelCode)?.[1] ?? null;
  const fields = [
    ["Тегі", member.surname], ["Аты", member.givenName], ["Әкесінің аты", member.patronymic],
    ["Туған күні", member.birthDate ? formatDate(member.birthDate) : member.birthYear], ["Телефон", member.phone], ["Email", member.email],
    ["Қала / аудан", member.cityDistrict], ["Филиал", member.branchName], ["Жұмыс немесе оқу орны", member.workplace],
    ["Лауазымы", member.position], ["Білім деңгейі", educationLevel], ["Оқу орны", member.educationInstitution],
    ["Мамандық", member.educationProgram], ["Математикадағы бағыты", member.mathSpecialization], ["Кәсіби жетістіктері", member.achievements],
    ["Кәсіби тәжірибесі", member.professionalExperience], ["Өмірбаян", member.biography],
  ];
  return <main className="dashboard-content">
    <a className="back-link dark-link" href="/dashboard/members"><ArrowLeft size={16} /> Мүшелерге оралу</a>
    <div className="detail-heading"><div><p>{member.branchName ?? "Филиал тағайындалмаған"}</p><h1>{member.fullName}</h1><span>Профиль № {member.id.slice(0, 8).toUpperCase()} · тіркелген: {formatDate(member.account?.createdAt ?? "")}</span></div><StatusBadge status={member.membershipStatus} /></div>
    {state.error && <div className="dash-alert error">Әрекетті орындау мүмкін болмады: {state.error === "protected" ? "басшылықтың қорғалған аккаунтын архивтеуге болмайды" : state.error === "self" ? "өзіңіздің аккаунтыңызды архивтеуге болмайды" : "деректерді тексеріңіз"}.</div>}
    <div className="detail-grid"><div className="detail-main">
      <section className="panel"><div className="panel-heading"><div><span>Профиль</span><h2>Адам туралы толық мәлімет</h2></div><UserRound size={19} /></div><dl className="profile-fields">{fields.map(([label, value]) => <div className={String(value ?? "").length > 80 ? "wide-field" : ""} key={String(label)}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></section>
      <section className="panel"><div className="panel-heading"><div><span>Өтініштер</span><h2>Мүшелік өтініштері</h2></div></div><div className="linked-record-list">{member.applications.map((application) => <a href={`/dashboard/applications/${application.id}`} key={application.id}><span>№ {application.id.slice(0, 8).toUpperCase()}</span><strong>{statusLabel(application.status)}</strong><small>{formatDate(application.submittedAt)}</small></a>)}{member.applications.length === 0 && <p className="muted">Өтініш жоқ.</p>}</div></section>
      <section className="panel"><div className="panel-heading"><div><span>Құжаттар</span><h2>Профильге тиесілі файлдар</h2></div><FileText size={19} /></div><div className="document-list">{member.documents.map((document) => <div key={document.id}><span><FileText size={18} /></span><div><strong>{document.originalName}</strong><small>{Math.ceil(document.sizeBytes / 1024)} КБ{document.status === "removal_requested" ? " · жою сұралды" : ""}</small></div><a href={`/api/documents/${document.id}`}><Download size={16} /> Ашу</a></div>)}{member.documents.length === 0 && <p className="muted">Құжат жоқ.</p>}</div></section>
      <section className="panel"><div className="panel-heading"><div><span>Расталған тарих</span><h2>Бірлестіктегі қызметі</h2></div><CalendarCheck size={19} /></div><div className="profile-event-list">{member.activities.map((activity) => {
        const href = activity.eventId ? `/dashboard/events/${activity.eventId}` : activity.projectId ? `/dashboard/projects/${activity.projectId}` : null;
        const content = <><div><strong>{activity.title}</strong><span>{formatDate(activity.occurredAt, true)}</span></div><small>{activity.status !== "ACTIVE" ? "Белгі кері қайтарылды" : activity.activityType === "PROJECT_PARTICIPATION" ? activity.description ?? "Жобаға қатысты" : "Іс-шараға нақты қатысты"}</small></>;
        return href ? <a href={href} key={activity.id}>{content}</a> : <div className="profile-activity-item" key={activity.id}>{content}</div>;
      })}{member.activities.length === 0 && <p className="muted">Расталған қызмет тарихы жоқ.</p>}</div></section>
    </div><aside className="detail-aside">
      <section className="panel"><div className="panel-heading"><div><span>Мүшелік</span><h2>Мәртебе</h2></div></div><dl className="compact-details"><div><dt>Мәртебе</dt><dd>{statusLabel(member.membershipStatus)}</dd></div><div><dt>Мүше болған күн</dt><dd>{formatDate(member.membershipStartedAt)}</dd></div><div><dt>Email расталған</dt><dd>{member.account?.emailVerifiedAt ? formatDate(member.account.emailVerifiedAt, true) : "Жоқ"}</dd></div><div><dt>Соңғы кіру</dt><dd>{formatDate(member.account?.lastLoginAt ?? "", true)}</dd></div></dl></section>
      <section className="panel"><div className="panel-heading"><div><span>Кәсіби байланыс</span><h2>Санаттар мен бөлімдер</h2></div></div><div className="category-chips">{member.professionalCategories.map((category) => <span key={category.id}>{category.name}</span>)}{member.professionalCategories.length === 0 && <small>Санат тағайындалмаған</small>}</div><div className="department-name-list">{member.departments.map((department) => <span key={department}>{department}</span>)}</div></section>
      <section className="panel history-card"><div className="panel-heading"><div><span>Тарих</span><h2>Мәртебе өзгерістері</h2></div><History size={19} /></div><div className="timeline">{member.history.map((entry, index) => <div key={`${entry.createdAt}-${index}`}><i /><div><strong>{entry.previousStatus ? `${statusLabel(entry.previousStatus)} → ` : ""}{statusLabel(entry.newStatus)}</strong><span>{formatDate(entry.createdAt, true)} · {entry.actorName}</span>{entry.reason && <p>{entry.reason}</p>}</div></div>)}</div></section>
      {isFullAccess(user) && member.userId !== user.id && <section className="danger-card"><span>Архивтеу</span><h2>Профильді тізімнен алып тастау</h2><p>Аккаунт кіре алмайды, өтініштері мен құжаттары тізімдерден жасырылады. Аудит тарихы сақталады.</p><form action={`/api/members/${member.id}/archive`} method="post"><input name="reason" required minLength={5} maxLength={500} placeholder="Архивтеу себебі" /><button className="button button-danger" type="submit"><Archive size={16} /> Архивтеу</button></form></section>}
      {isFullAccess(user) && member.userId !== user.id && <section className="danger-card permanent-erasure-card"><span>Біржола өшіру</span><h2>Аккаунт пен жеке деректерді жою</h2><p>Мәртебесіне қарамастан аккаунт өшіріледі. Іс-шара, жоба, шешім және аудит тарихы аноним түрде сақталады. Бұл әрекет қайтарылмайды.</p><form action={`/api/members/${member.id}/erase`} method="post"><input name="confirmation" required autoComplete="off" placeholder="Растау үшін ӨШІРУ деп жазыңыз" /><input name="reason" required minLength={5} maxLength={500} placeholder="Өшіру себебі" /><button className="button button-danger" type="submit"><Trash2 size={16} /> Біржола өшіру</button></form></section>}
    </aside></div>
  </main>;
}
