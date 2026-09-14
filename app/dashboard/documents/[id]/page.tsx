/* eslint-disable @next/next/no-html-link-for-pages -- vinext dashboard transitions require native navigation. */
import { Archive, ArrowLeft, Download, FileClock, FileText, History, RotateCcw } from "lucide-react";
import { notFound } from "next/navigation";
import { InstitutionalDocumentForm } from "@/app/components/InstitutionalDocumentForm";
import { getInstitutionalDocument, getInstitutionalDocumentOptions } from "@/db/institutional-documents";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessInstitutionalDocument, canManageBranchInstitutionalDocuments, canManageDepartmentInstitutionalDocuments,
  canManageGlobalInstitutionalDocuments, canManageInstitutionalDocument,
} from "@/lib/authorization";
import { formatDate } from "@/lib/format";
import { institutionalDocumentAccessLabel, institutionalDocumentScopeLabel, institutionalDocumentTypeLabel } from "@/lib/institutional-documents";

function message(state: { success?: string; error?: string }) {
  if (state.success === "version") return { kind: "success", text: "Жаңа файл нұсқасы қосылды. Бұрынғы нұсқа тарихта сақталды." };
  if (state.success) return { kind: "success", text: "Өзгеріс сақталып, аудит журналына тіркелді." };
  if (state.error === "duplicate") return { kind: "error", text: "Осы нөмір, күн және түрмен құжат бұрын тіркелген." };
  if (state.error) return { kind: "error", text: "Өзгеріс сақталмады. Деректерді, файлды және рұқсатты тексеріңіз." };
  return null;
}

export default async function InstitutionalDocumentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  const { id } = await params;
  const [document, state, options] = await Promise.all([getInstitutionalDocument(id), searchParams, getInstitutionalDocumentOptions(actor)]);
  if (!document || !canAccessInstitutionalDocument(actor, document)) notFound();
  const manageable = canManageInstitutionalDocument(actor, document);
  const global = canManageGlobalInstitutionalDocuments(actor);
  const note = message(state);
  const currentVersion = document.versions[0];
  return <main className="dashboard-content">
    <a className="back-link" href="/dashboard/documents"><ArrowLeft size={15} /> Ішкі құжаттар қоры</a>
    <div className="dash-page-heading"><div><p>{institutionalDocumentTypeLabel(document.documentType)} · № {document.documentNumber}</p><h1>{document.title}</h1></div><span className={`document-status ${document.status.toLowerCase()}`}>{document.status === "ACTIVE" ? "Қолданыста" : "Архив"}</span></div>
    {note && <div className={`dash-alert ${note.kind}`}>{note.text}</div>}
    <section className="document-detail-overview"><article><span>Құжат күні</span><strong>{formatDate(document.documentDate.toISOString())}</strong><small>{institutionalDocumentScopeLabel(document.scopeType)}</small></article><article><span>Жауапты құрылым</span><strong>{document.branch?.regionName ?? document.responsibleDepartment?.nameKk ?? "Орталық басқарма"}</strong><small>{institutionalDocumentAccessLabel(document.accessLevel)}</small></article><article><span>Қазіргі нұсқа</span><strong>№ {currentVersion?.versionNumber ?? 0}</strong><small>{currentVersion?.originalName ?? "Файл жоқ"}</small></article><article><span>Тіркеген</span><strong>{document.creator.profile?.fullName ?? "Жүйе"}</strong><small>{formatDate(document.createdAt.toISOString())}</small></article></section>
    {document.summary && <section className="panel document-summary"><span>Қысқаша мазмұны</span><p>{document.summary}</p></section>}
    {currentVersion && <a className="document-current-download" href={`/api/institutional-documents/${id}/versions/${currentVersion.id}`}><FileText size={22} /><span><strong>Қазіргі нұсқаны жүктеу</strong><small>{currentVersion.originalName} · {Math.ceil(currentVersion.sizeBytes / 1024)} КБ</small></span><Download size={18} /></a>}

    <div className="document-detail-grid">
      <section className="panel document-version-history"><div className="panel-heading"><div><span>Өзгермейтін тарих</span><h2><History size={18} /> Файл нұсқалары</h2></div><strong>{document.versions.length}</strong></div><div>{document.versions.map((version) => <article key={version.id}><span className="version-number">v{version.versionNumber}</span><div><strong>{version.originalName}</strong><p>{version.changeNote ?? "Түсіндірме берілмеген"}</p><small>{version.uploader.profile?.fullName ?? "Жүйе"} · {formatDate(version.createdAt.toISOString())} · {Math.ceil(version.sizeBytes / 1024)} КБ</small></div><a href={`/api/institutional-documents/${id}/versions/${version.id}`} title="Нұсқаны жүктеу"><Download size={16} /></a></article>)}</div></section>
      {manageable && document.status === "ACTIVE" && <section className="panel document-new-version"><div className="panel-heading"><div><span>Файлды алмастырмайды</span><h2><FileClock size={18} /> Жаңа нұсқа</h2></div></div><form action={`/api/institutional-documents/${id}/versions`} encType="multipart/form-data" method="post"><label><span>Жаңа файл *</span><input accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx" name="document" required type="file" /></label><label><span>Не өзгерді? *</span><textarea maxLength={1000} name="changeNote" required rows={4} /></label><button className="button button-primary" type="submit">Жаңа нұсқаны қосу</button></form></section>}
    </div>

    {manageable && document.status === "ACTIVE" && <details className="panel document-edit-panel"><summary>Құжат деректерін өңдеу</summary><InstitutionalDocumentForm action={`/api/institutional-documents/${id}`} branches={options.branches} departments={options.departments} canManageGlobal={global} canManageBranch={canManageBranchInstitutionalDocuments(actor)} canManageDepartment={canManageDepartmentInstitutionalDocuments(actor)} item={document} /></details>}
    {manageable && <section className="panel document-archive-panel"><div><span>{document.status === "ACTIVE" ? "Қолданыстан шығару" : "Қайта қолданысқа енгізу"}</span><h2>{document.status === "ACTIVE" ? <><Archive size={18} /> Архивке жіберу</> : <><RotateCcw size={18} /> Архивтен қайтару</>}</h2><p>Файлдар мен бұрынғы нұсқалар өшірілмейді және ресми тарих ретінде сақталады.</p></div><form action={`/api/institutional-documents/${id}`} method="post"><input name="action" type="hidden" value="status" /><input name="status" type="hidden" value={document.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} /><input maxLength={2000} name="reason" placeholder={document.status === "ACTIVE" ? "Архивке жіберу себебі *" : "Қайтару түсіндірмесі"} required={document.status === "ACTIVE"} /><button className={document.status === "ACTIVE" ? "button button-danger" : "button button-primary"} type="submit">{document.status === "ACTIVE" ? "Архивке жіберу" : "Қайтару"}</button></form></section>}
  </main>;
}
