import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications, isFullAccess } from "@/lib/authorization";
import { formatDate } from "@/lib/format";
import { listBranches, listMembers } from "@/db/queries";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const [members, branches, state] = await Promise.all([listMembers(user), listBranches(), searchParams]);
  const full = isFullAccess(user);
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Тұрақты профильдер</p><h1>Мүшелер мен мәртебелер</h1></div><span className="record-count">{members.length} профиль</span></div>{state.success && <div className="dash-alert success">Профиль жаңартылды. Бұрынғы мәндер аудит тарихында сақталды.</div>}{state.error && <div className="dash-alert error">Өзгерісті сақтау мүмкін болмады.</div>}<section className="panel"><div className="table-wrap"><table className="data-table member-table"><thead><tr><th>Аты-жөні</th><th>Байланыс / қызмет</th><th>Филиал</th><th>Мүшелік</th>{full && <th>Әкімшілік өзгеріс</th>}</tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.fullName}</strong><small>{member.email}</small></td><td><span>{member.workplace ?? "—"}</span><small>{member.position ?? member.phone}</small></td><td>{member.branchName ?? "—"}</td><td><StatusBadge status={member.membershipStatus} /><small>{formatDate(member.membershipStartedAt)}</small></td>{full && <td><details className="row-editor"><summary>Өзгерту</summary><form action={`/api/members/${member.id}`} method="post"><select name="membershipStatus" defaultValue={member.membershipStatus}><option value="registered_user">Тіркелген</option><option value="applicant">Үміткер</option><option value="reserve">Резерв</option><option value="member">Мүше</option><option value="rejected">Қабылданбады</option><option value="suspended">Тоқтатылған</option><option value="former_member">Бұрынғы мүше</option></select><select name="branchId" defaultValue={member.branchId ?? ""}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select><input name="reason" required minLength={5} placeholder="Өзгеріс себебі" /><button type="submit">Сақтау</button></form></details></td>}</tr>)}</tbody></table></div></section></main>;
}
