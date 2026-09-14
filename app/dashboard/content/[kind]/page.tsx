/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal dashboard left-click navigation. */
import { ArrowLeft, Plus, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { DynamicContentForm } from "@/app/components/DynamicContentForm";
import { listAdminDynamicContent } from "@/db/public-cms";
import { getCurrentUser } from "@/lib/auth";
import { canManageDynamicContent } from "@/lib/authorization";
import { dynamicContentMeta, dynamicStatusLabel, isDynamicContentKind } from "@/lib/dynamic-content";

export default async function DynamicContentListPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageDynamicContent(actor)) notFound();
  const { kind: rawKind } = await params;
  if (!isDynamicContentKind(rawKind)) notFound();
  const [items, state] = await Promise.all([listAdminDynamicContent(rawKind), searchParams]);
  const meta = dynamicContentMeta[rawKind];

  return <main className="dashboard-content">
    <a className="back-link" href="/dashboard/content"><ArrowLeft size={15} /> Сайт мазмұны</a>
    <div className="dash-page-heading"><div><p>Динамикалық мазмұн</p><h1>{meta.plural}</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Аудит қосылған</span></div>
    {state.error && <div className="dash-alert error">Материал сақталмады. Міндетті өрістерді, сілтемені және сурет өлшемін тексеріңіз.</div>}
    <div className="dynamic-admin-layout">
      <section className="panel dynamic-create-panel"><div className="panel-heading"><div><span>Жаңа жоба</span><h2><Plus size={17} /> {meta.singular} қосу</h2></div></div><DynamicContentForm kind={rawKind} action={`/api/content/${rawKind}`} submitLabel="Жобаны сақтау" /></section>
      <section className="panel dynamic-list-panel"><div className="panel-heading"><div><span>Барлығы</span><h2>{items.length} жазба</h2></div><a href={meta.publicHref} target="_blank" rel="noreferrer">Ашық бетті көру</a></div>
        <div className="dynamic-admin-list">{items.map((item) => {
          const title = "title" in item ? item.title : item.name;
          return <a href={`/dashboard/content/${rawKind}/${item.id}`} key={item.id}><div><strong>{title}</strong><small>{"slug" in item ? `/${item.slug}` : item.websiteUrl ?? "Сілтемесіз"}</small></div><span className={`content-status ${item.status.toLowerCase()}`}>{dynamicStatusLabel(item.status)}</span></a>;
        })}{items.length === 0 && <p className="empty-content">Әзірге жазба жоқ. Алғашқы материалды осы жерден жасаңыз.</p>}</div>
      </section>
    </div>
  </main>;
}
