/* eslint-disable @next/next/no-html-link-for-pages -- vinext dashboard transitions require native navigation. */
import { ArrowLeft, Download, FileText, History, LockKeyhole, MessageSquareText } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getApplicationDetail } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReopenApplication, canReviewApplications, isFullAccess } from "@/lib/authorization";
import { formatDate, statusLabel } from "@/lib/format";
import { educationLevels } from "@/lib/membership-application";

export default async function ApplicationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const { id } = await params;
  const state = await searchParams;
  const detail = await getApplicationDetail(user, id);
  if (!detail) notFound();
  const { application, documents, notes, history } = detail;
  const canDecide = new Set(["awaiting_review", "reserve"]).has(application.status);
  const canReopen = application.status === "rejected" && canReopenApplication(user);
  const educationLevel = educationLevels.find(([code]) => code === application.educationLevelCode)?.[1] ?? null;
  const fields = [
    ["Туған күні", application.birthDate ? formatDate(application.birthDate) : application.birthYear], ["Телефон", application.phone], ["Email", application.email],
    ["Қала / аудан", application.cityDistrict], ["Қазіргі жұмыс немесе оқу орны", application.workplace], ["Лауазымы немесе мәртебесі", application.position],
    ["Білім деңгейі", educationLevel], ["Білім алған немесе алып жатқан оқу орны", application.educationInstitution], ["Мамандығы / білім беру бағдарламасы", application.educationProgram],
    ["Математикадағы бағыты / мамандануы", application.mathSpecialization], ["Кәсіби жетістіктері", application.achievements], ["Бірлестікке қосылу мақсаты", application.joiningPurpose],
    ...(application.education ? [["Мұрағаттық білім дерегі", application.education]] : []),
    ...(application.professionalExperience ? [["Мұрағаттық кәсіби тәжірибе", application.professionalExperience]] : []),
    ...(application.biography ? [["Мұрағаттық кәсіби өмірбаян", application.biography]] : []),
  ];
  return <main className="dashboard-content">
    <a className="back-link dark-link" href="/dashboard/applications"><ArrowLeft size={16} /> Өтініштерге оралу</a>
    <div className="detail-heading"><div><p>{application.branchName}</p><h1>{application.status === "rejected" ? application.fullName : <a href={`/dashboard/members/${application.personId}`}>{application.fullName}</a>}</h1><span>Өтініш № {application.id.slice(0, 8).toUpperCase()} · {formatDate(application.submittedAt)}{application.status !== "rejected" && <> · <a href={`/dashboard/members/${application.personId}`}>Толық профильді ашу</a></>}</span></div><StatusBadge status={application.status} /></div>
    {state.success && <div className="dash-alert success">Өзгеріс сақталды және аудит журналында тіркелді.</div>}
    {state.error && <div className="dash-alert error">Әрекетті орындау мүмкін болмады. Енгізілген деректі тексеріңіз.</div>}
    <div className="detail-grid"><div className="detail-main">
      <section className="panel"><div className="panel-heading"><div><span>Профиль</span><h2>Өтініш берушінің мәліметтері</h2></div><span className="visibility-label">Филиалға көрінеді</span></div><dl className="profile-fields">{fields.map(([label, value]) => <div className={String(value ?? "").length > 80 ? "wide-field" : ""} key={String(label)}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></section>
      <section className="panel"><div className="panel-heading"><div><span>Құжаттар</span><h2>Қосымша файлдар</h2></div><LockKeyhole size={19} /></div><div className="document-list">{documents.map((document) => <div key={document.id}><span><FileText size={19} /></span><div><strong>{document.originalName}</strong><small>{document.mimeType} · {(document.sizeBytes / 1024).toFixed(0)} КБ{document.status === "removal_requested" ? " · жою сұралды" : ""}</small></div><a href={`/api/documents/${document.id}`}><Download size={17} /> Жүктеу</a></div>)}{documents.length === 0 && <p className="muted">Өтінішке құжат тіркелмеген.</p>}</div></section>
      <section className="panel"><div className="panel-heading"><div><span>Ішкі жұмыс</span><h2>Қызметтік жазбалар</h2></div><MessageSquareText size={19} /></div><form className="inline-note-form" action={`/api/applications/${application.id}/notes`} method="post"><textarea name="note" required minLength={3} placeholder="Қарауға қатысты қызметтік жазба..." rows={3} /><div><select name="visibility" defaultValue="branch"><option value="branch">Филиал және орталық</option>{isFullAccess(user) && <option value="central">Тек орталық әкімшілік</option>}</select><button className="button button-secondary" type="submit">Жазба қосу</button></div></form><div className="notes-list">{notes.map((note) => <article key={note.id}><div><strong>{note.authorName}</strong><span>{formatDate(note.createdAt, true)}</span></div><p>{note.note}</p><small>{note.visibility === "central" ? "Тек орталық" : "Филиал және орталық"}</small></article>)}</div></section>
    </div><aside className="detail-aside">
      {canDecide && <section className="decision-card"><span>Шешім қабылдау</span><h2>Өтінішті бағалау</h2><p>Шешімнің себебін жазыңыз. Ол ішкі тарихта өзгеріссіз сақталады.</p><form action={`/api/applications/${application.id}/decision`} method="post"><textarea name="reason" required minLength={5} rows={4} placeholder="Шешімге негіз болған себеп..." /><button name="decision" value="approved" className="decision approve" type="submit">Мақұлдау</button><button name="decision" value="reserve" className="decision reserve" type="submit">Резервке қою</button><button name="decision" value="rejected" className="decision reject" type="submit">Қабылдамау</button></form></section>}
      {canReopen && <section className="reopen-card"><span>Шешімді түзету</span><h2>Қайта қарауға қайтару</h2><p>Өтініш қайтадан «Қаралуда» күйіне өтеді. Бұрынғы шешім мен себеп тарихта сақталады.</p><form action={`/api/applications/${application.id}/reopen`} method="post"><textarea name="reason" required minLength={5} maxLength={1500} rows={4} placeholder="Неліктен қайта қаралатынын жазыңыз..." /><button className="button button-secondary" type="submit">Қайта қарауға қайтару</button></form></section>}
      <section className="panel history-card"><div className="panel-heading"><div><span>Тарих</span><h2>Мәртебе өзгерістері</h2></div><History size={19} /></div><div className="timeline">{history.map((item, index) => <div key={`${item.createdAt}-${index}`}><i /><div><strong>{item.previousStatus ? `${statusLabel(item.previousStatus)} → ` : ""}{statusLabel(item.newStatus)}</strong><span>{formatDate(item.createdAt, true)} · {item.actorName}</span>{item.reason && <p>{item.reason}</p>}</div></div>)}</div></section>
      <section className="source-card"><span>Өтініш көзі</span><strong>{application.source === "qr" ? "QR сілтемесі" : "Ресми сайт"}</strong><small>Қабылданған: {formatDate(application.submittedAt, true)}</small></section>
    </aside></div>
  </main>;
}
