import { Archive, FileStack, FileText, Plus, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { InstitutionalDocumentForm } from "@/app/components/InstitutionalDocumentForm";
import { getInstitutionalDocumentOptions, listInstitutionalDocuments } from "@/db/institutional-documents";
import { getCurrentUser } from "@/lib/auth";
import {
  canManageBranchInstitutionalDocuments,
  canManageDepartmentInstitutionalDocuments,
  canManageGlobalInstitutionalDocuments,
  canReadInstitutionalDocuments,
} from "@/lib/authorization";
import { formatDate } from "@/lib/format";
import {
  institutionalDocumentAccessLabel, institutionalDocumentAccessLevels, institutionalDocumentScopeLabel,
  institutionalDocumentTypeLabel, institutionalDocumentTypes,
} from "@/lib/institutional-documents";

interface SearchState { q?: string; documentType?: string; status?: string; accessLevel?: string; branchId?: string; departmentId?: string; from?: string; to?: string; success?: string; error?: string }

export default async function InstitutionalDocumentsPage({ searchParams }: { searchParams: Promise<SearchState> }) {
  const actor = (await getCurrentUser())!;
  const global = canManageGlobalInstitutionalDocuments(actor);
  const branch = canManageBranchInstitutionalDocuments(actor);
  const department = canManageDepartmentInstitutionalDocuments(actor);
  if (!canReadInstitutionalDocuments(actor) && !global && !branch && !department) notFound();
  const state = await searchParams;
  const [documents, options] = await Promise.all([listInstitutionalDocuments(actor, state), getInstitutionalDocumentOptions(actor)]);
  const canCreate = global || branch || department;
  const archived = state.status === "ARCHIVED";
  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Ресми институционалдық тарих</p><h1>Ішкі құжаттар қоры</h1></div><span className="immutable-pill"><FileStack size={15} /> Нұсқалары сақталады</span></div>
    {state.success && <div className="dash-alert success">Құжат қорға қосылып, аудит журналына тіркелді.</div>}
    {state.error === "duplicate" && <div className="dash-alert error">Осы нөмір, күн және түрмен құжат бұрын тіркелген.</div>}
    {state.error && state.error !== "duplicate" && <div className="dash-alert error">Құжат сақталмады. Міндетті өрістерді, файлды және рұқсат аумағын тексеріңіз.</div>}
    <section className="document-registry-summary"><article><span>Көрсетілген құжат</span><strong>{documents.length}</strong><small>{archived ? "архивте" : "қолданыста"}</small></article><article><span>Құжат түрі</span><strong>{new Set(documents.map((item) => item.documentType)).size}</strong><small>осы сүзгіде</small></article><article><span>Нұсқалар</span><strong>{documents.reduce((sum, item) => sum + item._count.versions, 0)}</strong><small>тарихта сақталған</small></article></section>
    <form className="document-registry-filter" method="get">
      <label className="search"><span>Іздеу</span><div><Search size={16} /><input defaultValue={state.q ?? ""} name="q" placeholder="Атауы, нөмірі немесе мазмұны" /></div></label>
      <label><span>Түрі</span><select defaultValue={state.documentType ?? ""} name="documentType"><option value="">Барлығы</option>{institutionalDocumentTypes.map((type) => <option key={type} value={type}>{institutionalDocumentTypeLabel(type)}</option>)}</select></label>
      <label><span>Күйі</span><select defaultValue={state.status ?? "ACTIVE"} name="status"><option value="ACTIVE">Қолданыста</option><option value="ARCHIVED">Архив</option></select></label>
      <label><span>Қолжетімділік</span><select defaultValue={state.accessLevel ?? ""} name="accessLevel"><option value="">Барлығы</option>{institutionalDocumentAccessLevels.map((level) => <option key={level} value={level}>{institutionalDocumentAccessLabel(level)}</option>)}</select></label>
      {options.branches.length > 0 && <label><span>Филиал</span><select defaultValue={state.branchId ?? ""} name="branchId"><option value="">Барлығы</option>{options.branches.map((item) => <option key={item.id} value={item.id}>{item.regionName}</option>)}</select></label>}
      {options.departments.length > 0 && <label><span>Жауапты құрылым</span><select defaultValue={state.departmentId ?? ""} name="departmentId"><option value="">Барлығы</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.nameKk}</option>)}</select></label>}
      <label><span>Бастап</span><input defaultValue={state.from ?? ""} name="from" type="date" /></label><label><span>Дейін</span><input defaultValue={state.to ?? ""} name="to" type="date" /></label>
      <button className="button" type="submit">Сүзу</button>
    </form>
    <div className={`document-registry-layout ${canCreate ? "" : "single"}`}>
      {canCreate && !archived && <details className="panel document-create-panel"><summary><Plus size={17} /> Жаңа ресми құжат тіркеу</summary><InstitutionalDocumentForm action="/api/institutional-documents" branches={options.branches} departments={options.departments} canManageGlobal={global} canManageBranch={branch} canManageDepartment={department} includeFile /></details>}
      <section className="panel document-registry-list"><div className="panel-heading"><div><span>{archived ? "Сақталған тарих" : "Қолданыстағы қор"}</span><h2>{documents.length} құжат</h2></div>{archived && <Archive size={20} />}</div><div>{documents.map((document) => <a href={`/dashboard/documents/${document.id}`} key={document.id} className="document-registry-row"><span className={`document-type-mark ${document.documentType.toLowerCase()}`}><FileText size={19} /></span><span className="document-row-main"><strong>{document.title}</strong><small>№ {document.documentNumber} · {formatDate(document.documentDate.toISOString())} · {institutionalDocumentTypeLabel(document.documentType)}</small><small>{document.branch?.regionName ?? document.responsibleDepartment?.nameKk ?? institutionalDocumentScopeLabel(document.scopeType)}</small></span><span className="document-row-meta"><i>{institutionalDocumentAccessLabel(document.accessLevel)}</i><small>{document._count.versions} нұсқа</small></span></a>)}{documents.length === 0 && <div className="empty-content">Бұл сүзгі бойынша қолжетімді құжат жоқ.</div>}</div></section>
    </div>
  </main>;
}
