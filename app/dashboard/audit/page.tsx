import { Activity, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { listAuditLogs } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canViewAudit } from "@/lib/authorization";
import { formatDate } from "@/lib/format";

function jsonSummary(value: string | null) {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
}

export default async function AuditPage() {
  const user = (await getCurrentUser())!;
  if (!canViewAudit(user)) notFound();
  const logs = await listAuditLogs();
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>Институционалдық бақылау</p><h1>Өзгермейтін аудит журналы</h1></div><span className="immutable-pill"><LockKeyhole size={15} /> Өңдеуге және өшіруге жабық</span></div><div className="audit-explainer"><Activity size={22} /><p>Әр әкімшілік әрекет орындаушы, нақты уақыт, нысан, алдыңғы және жаңа мәндермен бірге сақталады. Дерекқор триггерлері жазбаларды өзгертуге немесе өшіруге жол бермейді.</p></div><section className="panel"><div className="table-wrap"><table className="data-table audit-table"><thead><tr><th>Уақыт / орындаушы</th><th>Әрекет</th><th>Нысан</th><th>Алдыңғы мән</th><th>Жаңа мән</th><th>Себеп</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{formatDate(log.createdAt, true)}</strong><small>{log.actorName ?? "Жүйе"}<br />{log.ipAddress ?? "—"}</small></td><td><code>{log.actionType}</code></td><td><span>{log.targetEntity}</span><small>{log.targetEntityId.slice(0, 12)}</small></td><td><code className="json-cell">{jsonSummary(log.previousValue)}</code></td><td><code className="json-cell">{jsonSummary(log.newValue)}</code></td><td>{log.reason ?? "—"}</td></tr>)}</tbody></table></div></section></main>;
}
