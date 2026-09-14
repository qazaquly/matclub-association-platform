import { BriefcaseBusiness, Plus, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/app/components/ProjectForm";
import { getProjectFormOptions, listManagedProjects } from "@/db/projects";
import { getCurrentUser } from "@/lib/auth";
import { canManageBranchProjects, canManageDepartmentProjects, canManageGlobalProjects, canReadProjects } from "@/lib/authorization";
import { formatDate } from "@/lib/format";
import { projectCoverageLabel, projectScopeLabel, projectStatusLabel } from "@/lib/projects";

export default async function DashboardProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string; branchId?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  const canCreate = canManageGlobalProjects(actor) || canManageBranchProjects(actor) || canManageDepartmentProjects(actor);
  if (!canReadProjects(actor) && !canCreate) notFound();
  const [allProjects, options, state] = await Promise.all([listManagedProjects(actor), getProjectFormOptions(actor), searchParams]);
  const projects = allProjects.filter((project) => (!state.status || project.status === state.status)
    && (!state.scope || project.projectScope === state.scope || (state.scope === "BRANCH" && project.projectScope === "ALL_BRANCHES"))
    && (!state.branchId || project.branchId === state.branchId || project.projectScope === "ALL_BRANCHES"));
  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Жобалық жұмыс</p><h1>Жобаларды басқару</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Тұрақты тарих</span></div>
    {state.error && <div className="dash-alert error">Жоба сақталмады. Міндетті өрістерді, мерзімді және жауапты құрылымды тексеріңіз.</div>}
    <form className="event-filter" method="get"><label>Мәртебе<select defaultValue={state.status ?? ""} name="status"><option value="">Барлығы</option><option value="DRAFT">Жоба</option><option value="PLANNED">Жоспарланған</option><option value="ACTIVE">Жүріп жатыр</option><option value="PAUSED">Уақытша тоқтаған</option><option value="COMPLETED">Аяқталған</option><option value="CANCELLED">Болдырылмаған</option><option value="ARCHIVED">Архив</option></select></label><label>Деңгей<select defaultValue={state.scope ?? ""} name="scope"><option value="">Барлығы</option><option value="NATIONAL">Республикалық</option><option value="BRANCH">Филиалдық</option><option value="ALL_BRANCHES">Барлық филиалға</option></select></label>{state.branchId && <input name="branchId" type="hidden" value={state.branchId} />}<button className="button" type="submit">Сүзу</button></form>
    <div className={`project-admin-layout ${canCreate ? "" : "single"}`}>
      {canCreate && <section className="panel project-create-panel"><div className="panel-heading"><div><span>Жаңа жұмыс</span><h2><Plus size={17} /> Жоба ашу</h2></div></div><ProjectForm action="/api/projects" options={options} canChooseNational={canManageGlobalProjects(actor) || canManageDepartmentProjects(actor)} canChooseAllBranches={canManageGlobalProjects(actor)} submitLabel="Жобаны сақтау" /></section>}
      <section className="panel project-list-panel"><div className="panel-heading"><div><span>Қолжетімді жобалар</span><h2>{projects.length} жоба</h2></div></div><div className="project-admin-list">{projects.map((project) => <a href={`/dashboard/projects/${project.id}`} key={project.id}><span className="project-list-icon"><BriefcaseBusiness size={18} /></span><span><strong>{project.title}</strong><small>{projectScopeLabel(project.projectScope)} · {projectCoverageLabel(project)}</small><small>{formatDate(project.startDate.toISOString())} — {project.endDate ? formatDate(project.endDate.toISOString()) : "мерзімсіз"}</small></span><span><i className={`project-status ${project.status.toLowerCase()}`}>{projectStatusLabel(project.status)}</i><small>{project._count.participants} қатысушы · {project._count.stages} кезең</small></span></a>)}{projects.length === 0 && <div className="empty-content">Бұл сүзгіде жоба жоқ.</div>}</div></section>
    </div>
  </main>;
}
