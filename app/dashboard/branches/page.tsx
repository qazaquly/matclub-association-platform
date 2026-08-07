import { Building2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { listBranches } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBranch, canReviewApplications, isFullAccess } from "@/lib/authorization";

export default async function DashboardBranchesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const [allBranches, state] = await Promise.all([listBranches(), searchParams]);
  const full = isFullAccess(user);
  const branches = full ? allBranches : allBranches.filter((branch) => canAccessBranch(user, branch.id));
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Өңірлік құрылым</p><h1>Филиалдар</h1></div><span className="record-count">{branches.length} филиал</span></div>{state.success && <div className="dash-alert success">Филиал деректері жаңартылды және аудитке жазылды.</div>}{state.error && <div className="dash-alert error">Филиал деректерін жаңарту мүмкін болмады.</div>}<div className="branch-admin-grid">{branches.map((branch) => <article className="branch-admin-card" key={branch.id}><div className="branch-admin-head"><span><Building2 size={21} /></span><StatusBadge status={branch.status} /></div><h2>{branch.name}</h2><p><MapPin size={15} /> {branch.regionName}</p><dl><div><dt>Мүше</dt><dd>{branch.memberCount}</dd></div><div><dt>Үміткер</dt><dd>{branch.applicantCount}</dd></div><div><dt>Резерв</dt><dd>{branch.reserveCount}</dd></div></dl><div className="director-row"><span>Директор</span><strong>{branch.directorName ?? "Тағайындалмаған"}</strong></div>{full && <details className="branch-editor"><summary>Филиалды басқару</summary><form action={`/api/branches/${branch.id}`} method="post"><label>Атауы<input name="name" defaultValue={branch.name} required /></label><label>Мәртебе<select name="status" defaultValue={branch.status}><option value="active">Белсенді</option><option value="inactive">Белсенді емес</option><option value="archived">Мұрағат</option></select></label><label>Себеп<input name="reason" required minLength={5} placeholder="Өзгеріс себебі" /></label><button type="submit">Сақтау</button></form></details>}</article>)}</div></main>;
}
