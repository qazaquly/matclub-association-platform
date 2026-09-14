import { Search } from "lucide-react";
import { notFound } from "next/navigation";
import { listBranches, listProfessionalCategories, listProfessionalProfiles } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { isDepartmentAccess, isNationwideProfessionalAccess } from "@/lib/authorization";

export default async function ProfessionalPage({ searchParams }: { searchParams: Promise<{ categoryId?: string; branchId?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!isDepartmentAccess(user)) notFound();
  const state = await searchParams;
  const filters = { categoryId: state.categoryId || undefined, branchId: state.branchId || undefined };
  const nationwide = isNationwideProfessionalAccess(user);
  const [rows, categories, branches] = await Promise.all([
    listProfessionalProfiles(user, filters),
    listProfessionalCategories(),
    listBranches(),
  ]);
  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>B деңгейі · {nationwide ? "Республикалық кәсіби міндет" : "Департамент міндеті"}</p><h1>Кәсіби деректер</h1></div><span className="record-count">{rows.length} мүше</span></div>
    <div className="audit-explainer"><p>{nationwide ? "I вице-президентке республикалық кәсіби деректер көрсетіледі." : "Тек сіз басқаратын департаментке ішкі тәртіппен тағайындалған адамдар көрсетіледі."} Байланыс деректері, ішкі жазбалар, өтініш құжаттары және әкімшілік мәртебе тарихы берілмейді.</p></div>
    <form className="professional-filter" method="get">
      <span><Search size={16} /> Рұқсат аумағындағы кәсіби деректер</span>
      <label>Кәсіби санат<select name="categoryId" defaultValue={filters.categoryId ?? ""}><option value="">Барлық санат</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}{category.status === "inactive" ? " · белсенді емес" : ""}</option>)}</select></label>
      <label>Өңір<select name="branchId" defaultValue={filters.branchId ?? ""}><option value="">Барлық өңір</option>{branches.filter((branch) => branch.status === "active").map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select></label>
      <button type="submit">Сүзу</button>
    </form>
    <section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Мүше</th><th>Жұмыс орны</th><th>Лауазымы</th><th>Мамандану</th><th>Кәсіби санаттар</th><th>Өңір</th>{!nationwide && <th>Департамент</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.fullName}</strong></td><td>{row.workplace ?? "—"}</td><td>{row.position ?? "—"}</td><td>{row.specialization ?? "—"}</td><td><div className="category-chips">{row.professionalCategories.length ? row.professionalCategories.map((category) => <span className={category.status === "inactive" ? "inactive" : ""} key={category.id}>{category.name}</span>) : <small>Тағайындалмаған</small>}</div></td><td>{row.regionName ?? "—"}</td>{!nationwide && <td>{row.departments.join(", ") || "—"}</td>}</tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state"><h2>Мүше табылмады</h2><p>Сүзгі мен қолжетімділік аумағына сәйкес кәсіби профиль жоқ.</p></div>}</div></section>
  </main>;
}
