import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { DynamicContentForm } from "@/app/components/DynamicContentForm";
import { getAdminDynamicContent } from "@/db/public-cms";
import { getCurrentUser } from "@/lib/auth";
import { canManageDynamicContent, canPublishDynamicContent } from "@/lib/authorization";
import { automaticDeletionDate, dynamicContentMeta, dynamicStatusLabel, isDynamicContentKind } from "@/lib/dynamic-content";
import { formatDate } from "@/lib/format";

export default async function DynamicContentEditPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageDynamicContent(actor)) notFound();
  const { kind: rawKind, id } = await params;
  if (!isDynamicContentKind(rawKind)) notFound();
  const [item, state] = await Promise.all([getAdminDynamicContent(rawKind, id), searchParams]);
  if (!item) notFound();
  const meta = dynamicContentMeta[rawKind];
  const title = "title" in item ? item.title : item.name;
  const publicHref = "slug" in item ? `${meta.publicHref}/${item.slug}` : meta.publicHref;
  const canPublish = canPublishDynamicContent(actor);
  const isVisible = item.status === "PUBLISHED" || item.status === "active";
  const isArchived = item.status === "ARCHIVED" || item.status === "inactive";
  const deletionDate = automaticDeletionDate(rawKind, item);

  return <main className="dashboard-content">
    <a className="back-link" href={`/dashboard/content/${rawKind}`}><ArrowLeft size={15} /> {meta.plural}</a>
    <div className="dash-page-heading"><div><p>{meta.singular}</p><h1>{title}</h1></div><span className={`content-status ${item.status.toLowerCase()}`}>{dynamicStatusLabel(item.status)}</span></div>
    {state.success && <div className="dash-alert success">Өзгеріс сақталды және аудит журналына тіркелді.</div>}
    {state.error && <div className="dash-alert error">Өзгеріс сақталмады. Өрістерді, сілтемені және суретті тексеріңіз.</div>}
    <div className="content-admin-note"><ShieldCheck size={22} /><p>Жарияланған материалды түзетуге болады: нұсқа ашық күйінде қалады, ал алдыңғы және жаңа мәндер аудитке жазылады.</p></div>
    {deletionDate && <div className="dash-alert error">Бұл материал архивте. Қайтарылмаса, {formatDate(deletionDate.toISOString())} күні автоматты түрде толық өшеді. Аудит жазбасы сақталады.</div>}
    <section className="panel dynamic-edit-panel"><DynamicContentForm kind={rawKind} item={item} action={`/api/content/${rawKind}/${id}`} submitLabel="Өзгерісті сақтау" /></section>
    <div className="dynamic-publish-bar">
      <a className="button" href={publicHref} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ашық бетті көру</a>
      {canPublish && <div>
        {!isVisible && <form action={`/api/content/${rawKind}/${id}`} method="post"><button className="button button-primary" name="action" value="publish" type="submit">{rawKind === "partners" ? "Сайтта көрсету" : "Жариялау"}</button></form>}
        {!isArchived && <form action={`/api/content/${rawKind}/${id}`} method="post"><button className="button button-danger" name="action" value="archive" type="submit">{rawKind === "partners" ? "Жасыру" : "Архивке алу"}</button></form>}
        {isArchived && rawKind !== "partners" && <form action={`/api/content/${rawKind}/${id}`} method="post"><button className="button" name="action" value="restore" type="submit">Архивтен қайтару</button></form>}
      </div>}
    </div>
  </main>;
}
