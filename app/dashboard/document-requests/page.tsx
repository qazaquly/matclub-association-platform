import { Check, Download, FileX2, X } from "lucide-react";
import { notFound } from "next/navigation";
import { listDocumentRemovalRequests } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { isFullAccess } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

export default async function DocumentRequestsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!isFullAccess(user)) notFound();
  const [requests, state] = await Promise.all([listDocumentRemovalRequests(), searchParams]);
  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Құжаттарды бақылау</p><h1>Жою сұраулары</h1></div><span className="record-count">{requests.length} сұрау</span></div>
    {state.success && <div className="dash-alert success">Шешім орындалды және аудит журналында сақталды.</div>}
    {state.error && <div className="dash-alert error">Шешімді орындау мүмкін болмады. Себепті тексеріңіз.</div>}
    <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Құжат</th><th>Иесі</th><th>Филиал</th><th>Сұралған</th><th>Себеп</th><th>Шешім</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.originalName}</strong><small>{request.mimeType} · {Math.ceil(request.sizeBytes / 1024)} КБ</small><a className="row-action" href={`/api/documents/${request.id}`}><Download size={14} /> Тексеру</a></td><td><a className="table-person-link" href={`/dashboard/members/${request.ownerPersonId}`}><strong>{request.ownerName}</strong><small>{request.ownerEmail}</small></a>{request.applicationId && <a className="row-action" href={`/dashboard/applications/${request.applicationId}`}>Өтінішті ашу</a>}</td><td>{request.branchName ?? "—"}</td><td>{formatDate(request.requestedAt, true)}</td><td>{request.reason ?? "Себеп көрсетілмеген"}</td><td><div className="removal-decision-actions"><form action={`/api/documents/${request.id}/removal-decision`} method="post"><input type="hidden" name="decision" value="approve" /><input name="reason" required minLength={5} maxLength={500} placeholder="Мақұлдау себебі" /><button className="approve" type="submit"><Check size={14} /> Мақұлдау</button></form><form action={`/api/documents/${request.id}/removal-decision`} method="post"><input type="hidden" name="decision" value="reject" /><input name="reason" required minLength={5} maxLength={500} placeholder="Қабылдамау себебі" /><button className="reject" type="submit"><X size={14} /> Қабылдамау</button></form></div></td></tr>)}</tbody></table>{requests.length === 0 && <div className="empty-state"><FileX2 size={28} /><h2>Жою сұрауы жоқ</h2><p>Пайдаланушылар жіберген сұраулар осы жерде көрінеді.</p></div>}</div></section>
  </main>;
}
