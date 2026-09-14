import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canExportReports, canViewReports } from "@/lib/authorization";
import { listBranches } from "@/db/queries";
import { buildReport, normalizeReportFilters, type ReportKind } from "@/db/reports";

const kindLabels: Record<ReportKind, string> = {
  members: "Мүшелер",
  applications: "Өтініштер",
  events: "Іс-шаралар",
  projects: "Жобалар",
};

const statuses: Record<ReportKind, Array<[string, string]>> = {
  members: [["", "Барлық мәртебе"], ["registered_user", "Тіркелген"], ["applicant", "Үміткер"], ["reserve", "Резерв"], ["member", "Мүше"], ["suspended", "Тоқтатылған"], ["former_member", "Бұрынғы мүше"]],
  applications: [["", "Барлық шешім"], ["awaiting_review", "Қаралуда"], ["approved", "Мақұлданған"], ["reserve", "Резерв"], ["rejected", "Қабылданбаған"]],
  events: [["", "Барлық мәртебе"], ["DRAFT", "Жоба"], ["SUBMITTED", "Жариялауға жіберілген"], ["PUBLISHED", "Жарияланған"], ["POSTPONED", "Кейінге қалдырылған"], ["CANCELLED", "Болдырылмаған"], ["COMPLETED", "Аяқталған"]],
  projects: [["", "Барлық мәртебе"], ["DRAFT", "Жоба"], ["PLANNED", "Жоспарланған"], ["ACTIVE", "Жүріп жатыр"], ["PAUSED", "Уақытша тоқтаған"], ["COMPLETED", "Аяқталған"], ["CANCELLED", "Болдырылмаған"]],
};

function queryString(input: Record<string, string | undefined>, extra: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...input, ...extra })) if (value) params.set(key, value);
  return params.toString();
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = (await getCurrentUser())!;
  if (!canViewReports(actor)) notFound();
  const state = await searchParams;
  const filters = normalizeReportFilters(state);
  const [report, branches] = await Promise.all([buildReport(actor, filters), listBranches(actor)]);
  const exportBase = { kind: filters.kind, branchId: filters.branchId, status: filters.status, q: filters.query, from: filters.from, to: filters.to };
  const mayExport = canExportReports(actor);

  return <main className="dashboard-content report-page">
    <div className="dash-page-heading"><div><p>Басқару есебі</p><h1>Есептер және дерек шығару</h1></div><span className="record-count">{report.rows.length} жол</span></div>
    <nav className="report-tabs" aria-label="Есеп түрлері">{(Object.keys(kindLabels) as ReportKind[]).map((kind) => <Link className={filters.kind === kind ? "active" : ""} href={`/dashboard/reports?kind=${kind}`} key={kind}>{kindLabels[kind]}</Link>)}</nav>
    <form className="report-filters" method="get">
      <input type="hidden" name="kind" value={filters.kind} />
      <label>Өңір<select name="branchId" defaultValue={filters.branchId ?? ""}><option value="">Барлық рұқсат етілген өңір</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select></label>
      <label>Мәртебе<select name="status" defaultValue={filters.status ?? ""}>{statuses[filters.kind].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Басталған күні<input type="date" name="from" defaultValue={filters.from ?? ""} /></label>
      <label>Аяқталған күні<input type="date" name="to" defaultValue={filters.to ?? ""} /></label>
      <label className="report-query">Іздеу<input name="q" maxLength={120} defaultValue={filters.query ?? ""} placeholder="Аты, өңірі, ұйымы немесе атауы" /></label>
      <div className="report-filter-actions"><button type="submit"><Search size={15} /> Көрсету</button><Link href={`/dashboard/reports?kind=${filters.kind}`}>Тазарту</Link></div>
    </form>
    <section className="report-summary">{report.summary.map((item) => <article key={item.label}><strong>{item.value.toLocaleString("kk-KZ")}</strong><span>{item.label}</span></article>)}</section>
    <section className="panel report-results">
      <div className="report-results-head"><div><h2>{report.title}</h2><p>{report.periodLabel}</p></div>{mayExport && <div className="report-downloads"><a href={`/api/reports/export?${queryString(exportBase, { format: "xlsx" })}`}><FileSpreadsheet size={16} /> Excel</a><a href={`/api/reports/export?${queryString(exportBase, { format: "pdf" })}`}><FileText size={16} /> PDF</a></div>}</div>
      <div className="table-wrap"><table className="data-table report-table"><thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{report.rows.slice(0, 100).map((row, index) => <tr key={index}>{report.columns.map((column) => <td className={column.numeric ? "numeric" : ""} key={column.key}>{String(row[column.key] ?? "") || "—"}</td>)}</tr>)}</tbody></table>{report.rows.length === 0 && <div className="empty-state"><Download size={28} /><h2>Дерек табылмады</h2><p>Сүзгілерді өзгертіп көріңіз.</p></div>}</div>
      {report.rows.length > 100 && <p className="report-preview-note">Экранда алғашқы 100 жол көрсетілді. Excel және PDF файлдарына барлық {report.rows.length} жол кіреді.</p>}
    </section>
  </main>;
}
