import { notFound } from "next/navigation";
import { ensureDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isDepartmentAccess } from "@/lib/authorization";

export default async function ProfessionalPage() {
  const user = (await getCurrentUser())!;
  if (!isDepartmentAccess(user)) notFound();
  await ensureDatabase();
  const rows = await getRawDb().prepare(
    `SELECT p.full_name AS fullName, p.workplace, p.position,
            p.math_specialization AS specialization, b.region_name AS regionName
     FROM person_profiles p LEFT JOIN branches b ON b.id = p.branch_id
     WHERE p.membership_status = 'member' AND p.archived_at IS NULL ORDER BY p.full_name`,
  ).all<{ fullName: string; workplace: string | null; position: string | null; specialization: string | null; regionName: string | null }>();
  return <main className="dashboard-content"><div className="dash-page-heading"><div><p>B деңгейі · Кәсіби міндет</p><h1>Кәсіби деректер</h1></div><span className="record-count">{rows.results.length} мүше</span></div><div className="audit-explainer"><p>Бұл көрініс мақсатқа сай шектелген: байланыс деректері, ішкі жазбалар, өтініш құжаттары және әкімшілік мәртебе тарихы берілмейді.</p></div><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Мүше</th><th>Жұмыс орны</th><th>Лауазымы</th><th>Мамандану</th><th>Өңір</th></tr></thead><tbody>{rows.results.map((row) => <tr key={row.fullName}><td><strong>{row.fullName}</strong></td><td>{row.workplace ?? "—"}</td><td>{row.position ?? "—"}</td><td>{row.specialization ?? "—"}</td><td>{row.regionName ?? "—"}</td></tr>)}</tbody></table></div></section></main>;
}
