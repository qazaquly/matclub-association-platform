import { ShieldCheck, Tags } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getProfessionalCategoryAdminData } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canManageProfessionalCategoryCatalog } from "@/lib/authorization";

export default async function ProfessionalCategoriesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageProfessionalCategoryCatalog(actor)) notFound();
  const [categories, state] = await Promise.all([getProfessionalCategoryAdminData(), searchParams]);

  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Ресми кәсіби метадерек</p><h1>Кәсіби санаттар</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Арнайы құқық</span></div>
    {state.success && <div className="dash-alert success">Кәсіби санат өзгерісі сақталды және аудитке тіркелді.</div>}
    {state.error && <div className="dash-alert error">Кәсіби санатты сақтау мүмкін болмады. Атауы мен мәндерін тексеріңіз.</div>}
    <div className="content-admin-note"><Tags size={20} /><p>Кәсіби санат мүшелік мәртебесі, жүйелік рөл, департамент және филиалдан бөлек сақталады. Санатты белсенді емес ету бұрынғы тағайындауларды жоймайды.</p></div>

    <div className="access-grid category-admin-layout">
      <section className="panel">
        <div className="panel-heading"><div><span>Каталог</span><h2>Жаңа санат</h2></div><Tags size={20} /></div>
        <form className="role-form" action="/api/professional-categories" method="post">
          <label>Көрінетін атауы<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Қысқа сипаттама<textarea name="description" rows={3} maxLength={600} /></label>
          <label>Көрсету реті<input name="sortOrder" type="number" min={0} max={10000} defaultValue={categories.length ? Math.max(...categories.map((category) => category.sortOrder)) + 10 : 10} required /></label>
          <label>Өзгеріс себебі<input name="reason" maxLength={500} placeholder="Қажет болған жағдайда негіздеме" /></label>
          <button className="button button-secondary" type="submit">Санат құру</button>
        </form>
      </section>

      <section className="panel wide">
        <div className="panel-heading"><div><span>Өңделетін бастапқы каталог</span><h2>Санаттар</h2></div><span>{categories.length} санат</span></div>
        <div className="category-admin-list">{categories.map((category) => <article key={category.id}>
          <div className="category-admin-summary"><div><strong>{category.name}</strong><small>{category.description || "Сипаттама берілмеген"}</small></div><div><StatusBadge status={category.status} /><span>{category.activeAssignmentCount} адам</span></div></div>
          <details className="branch-editor"><summary>Санатты өңдеу</summary><form action={`/api/professional-categories/${category.id}`} method="post">
            <label>Көрінетін атауы<input name="name" required minLength={2} maxLength={120} defaultValue={category.name} /></label>
            <label>Қысқа сипаттама<textarea name="description" rows={2} maxLength={600} defaultValue={category.description ?? ""} /></label>
            <div className="category-form-row"><label>Көрсету реті<input name="sortOrder" type="number" min={0} max={10000} defaultValue={category.sortOrder} required /></label><label>Мәртебе<select name="status" defaultValue={category.status}><option value="active">Белсенді</option><option value="inactive">Белсенді емес</option></select></label></div>
            <label>Өзгеріс себебі<input name="reason" maxLength={500} placeholder="Қажет болған жағдайда негіздеме" /></label>
            <button type="submit">Сақтау</button>
          </form></details>
          <small className="category-history-count">Тарихи тағайындау: {category.historicalPersonCount} адам</small>
        </article>)}</div>
      </section>
    </div>
  </main>;
}
