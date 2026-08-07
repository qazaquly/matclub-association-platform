import Link from "next/link";
import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listApplications } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

export default async function ApplicationsPage() {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const applications = await listApplications(user);
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Мүшелік процесі</p><h1>Өтініштер</h1></div><span className="record-count">{applications.length} жазба</span></div><div className="filter-bar"><div><Search size={17} /><span>Өтініштер жауапкершілік аумағыңыз бойынша сүзілген</span></div><span><ClipboardList size={17} /> Ағымдағы және тарихи шешімдер</span></div><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Үміткер</th><th>Қала / аудан</th><th>Филиал</th><th>Жіберілген</th><th>Мәртебе</th><th /></tr></thead><tbody>{applications.map((application) => <tr key={application.id}><td><strong>{application.fullName}</strong><small>{application.workplace ?? application.email}</small></td><td>{application.cityDistrict}</td><td>{application.branchName}</td><td>{formatDate(application.submittedAt)}</td><td><StatusBadge status={application.status} /></td><td><Link className="row-action" href={`/dashboard/applications/${application.id}`}>Ашу <ArrowRight size={15} /></Link></td></tr>)}</tbody></table>{applications.length === 0 && <div className="empty-state"><ClipboardList size={28} /><h2>Өтініш жоқ</h2><p>Жауапкершілік аумағыңызда қаралатын өтініш табылмады.</p></div>}</div></section></main>;
}
