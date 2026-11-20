/* eslint-disable @next/next/no-html-link-for-pages -- Use native navigation with Vinext. */
import { withListOrigin } from "@/lib/list-navigation";
import { directoryPage, directoryPageSize, directoryUrl } from "@/lib/directory-pagination";
import { DirectoryPagination } from "@/app/components/DirectoryPagination";
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

interface SearchState { page?: string; q?: string; documentType?: string; status?: string; accessLevel?: string; branchId?: string; departmentId?: string; from?: string; to?: string; success?: string; error?: string }

export default async function InstitutionalDocumentsPage({ searchParams }: { searchParams: Promise<SearchState> }) {
  const actor = (await getCurrentUser())!;
  const global = canManageGlobalInstitutionalDocuments(actor);
  const branch = canManageBranchInstitutionalDocuments(actor);
  const department = canManageDepartmentInstitutionalDocuments(actor);
  if (!canReadInstitutionalDocuments(actor) && !global && !branch && !department) notFound();
  const state = await searchParams;
  const page = directoryPage(state.page);
  const offset = (page - 1) * directoryPageSize;
  const url = (number: number) => directoryUrl("/dashboard/documents", { ...state }, ["q", "branchId", "departmentId", "status", "accessLevel", "documentType", "from", "to"], number);
  const [results, options] = await Promise.all([listInstitutionalDocuments(actor, state, directoryPageSize + 1, offset), getInstitutionalDocumentOptions(actor)]);
  const origin = url(page);
  const documents = results.slice(0, directoryPageSize);
  const canCreate = global || branch || department;
  const archived = state.status === "ARCHIVED";
  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Ресми институционалдық тарих</p><h1>Ішкі құжаттар қоры</h1></div><span className="immutable-pill"><FileStack size={15} /> Нұсқалары сақталады</span></div>
    {state.success && <div className="dash-alert success">Құжат қорға қосылып, аудит журналына тіркелді.</div>}
    {state.error === "duplicate" && <div className="dash-alert error">Осы нөмір, күн және түрмен құжат бұрын тіркелген.</div>}
    {state.error && state.error !== "duplicate" && <div className="dash-alert error">Құжат сақталмады. Міндетті өрістерді, файлды және рұқсат аумағын тексеріңіз.</div>}
    <details className="registry-filters" open={Boolean(state.q || state.from || state.to || state.documentType || state.accessLevel || state.branchId || state.departmentId || archived)}>
      <summary><Search size={17} /> Іздеу және сүзгілер</summary>
    <form className="document-registry-filter" method="get">
      <label className="search"><span>Іздеу</span><div><Search size={16} /><input defaultValue={state.q ?? ""} name="q" placeholder="Атауы, нөмірі немесе мазмұны" /></div></label>
      <label><span>Түрі</span><select defaultValue={state.documentType ?? ""} name="documentType"><option value="">Барлығы</option>{institutionalDocumentTypes.map((type) => <option key={type} value={type}>{institutionalDocumentTypeLabel(type)}</option>)}</select></label>
      <label><span>Күйі</span><select defaultValue={state.status ?? "ACTIVE"} name="status"><option value="ACTIVE">Қолданыста</option><option value="ARCHIVED">Архив</option></select></label>
      <label><span>Қолжетімділік</span><select defaultValue={state.accessLevel ?? ""} name="accessLevel"><option value="">Барлығы</option>{institutionalDocumentAccessLevels.map((level) => <option key={level} value={level}>{institutionalDocumentAccessLabel(level)}</option>)}</select></label>
      {options.branches.length > 0 && <label><span>Филиал</span><select defaultValue={state.branchId ?? ""} name="branchId"><option value="">Барлығы</option>{options.branches.map((item) => <option key={item.id} value={item.id}>{item.regionName}</option>)}</select></label>}
      {options.departments.length > 0 && <label><span>Жауапты құрылым</span><select defaultValue={state.departmentId ?? ""} name="departmentId"><option value="">Барлығы</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.nameKk}</option>)}</select></label>}
      <label><span>Бастап</span><input defaultValue={state.from ?? ""} name="from" type="date" /></label><label><span>Дейін</span><input defaultValue={state.to ?? ""} name="to" type="date" /></label>
      <button className="button" type="submit">Сүзу</button><a href="/dashboard/documents">Тазарту</a>
    </form></details>
    <div className={`document-registry-layout ${canCreate ? "" : "single"}`}>
      {canCreate && !archived && <details className="panel document-create-panel" open={Boolean(state.error)}><summary><Plus size={17} /> Жаңа ресми құжат тіркеу</summary><InstitutionalDocumentForm action="/api/institutional-documents" branches={options.branches} departments={options.departments} canManageGlobal={global} canManageBranch={branch} canManageDepartment={department} includeFile /></details>}
      <section className="panel document-registry-list"><div className="panel-heading"><div><span>{archived ? "Сақталған тарих" : "Қолданыстағы қор"}</span><h2>{documents.length ? `${offset + 1}–${offset + documents.length}` : 0} құжат</h2></div>{archived && <Archive size={20} />}</div><div>{documents.map((document) => <a href={withListOrigin(`/dashboard/documents/${document.id}`, origin.includes("?") ? origin : undefined)} key={document.id} className="document-registry-row"><span className={`document-type-mark ${document.documentType.toLowerCase()}`}><FileText size={19} /></span><span className="document-row-main"><strong>{document.title}</strong><small>№ {document.documentNumber} · {formatDate(document.documentDate.toISOString())} · {institutionalDocumentTypeLabel(document.documentType)}</small><small>{document.branch?.regionName ?? document.responsibleDepartment?.nameKk ?? institutionalDocumentScopeLabel(document.scopeType)}</small></span><span className="document-row-meta"><i>{institutionalDocumentAccessLabel(document.accessLevel)}</i><small>{document._count.versions} нұсқа</small></span></a>)}{documents.length === 0 && <div className="empty-content">Бұл сүзгі бойынша қолжетімді құжат жоқ.</div>}</div></section>
    </div>
    <DirectoryPagination page={page} more={results.length > directoryPageSize} url={url} />
  </main>;
}
