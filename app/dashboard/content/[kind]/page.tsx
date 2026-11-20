/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal dashboard left-click navigation. */
import { CatalogViews } from "@/app/components/CatalogViews";
import { ArrowLeft, Plus, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { DynamicContentForm } from "@/app/components/DynamicContentForm";
import { listAdminDynamicContent } from "@/db/public-cms";
import { getCurrentUser } from "@/lib/auth";
import { canManageDynamicContent } from "@/lib/authorization";
import { dynamicContentKinds, dynamicContentMeta, dynamicStatusLabel, isDynamicContentKind } from "@/lib/dynamic-content";

export default async function DynamicContentListPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; create?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageDynamicContent(actor)) notFound();
  const { kind: rawKind } = await params;
  if (!isDynamicContentKind(rawKind)) notFound();
  const [allItems, state] = await Promise.all([listAdminDynamicContent(rawKind), searchParams]);
  const needle = state.q?.trim().toLocaleLowerCase("kk-KZ");
  const items = allItems.filter((item) => !needle || ("title" in item ? item.title : item.name).toLocaleLowerCase("kk-KZ").includes(needle));
  const meta = dynamicContentMeta[rawKind];

  const base = `/dashboard/content/${rawKind}`;
  const creating = Boolean(state.create === "1" || state.error);

  return <main className="dashboard-content">
    <a className="back-link" href="/dashboard/content"><ArrowLeft size={15} /> Сайт мазмұны</a>
    <nav className="task-links" aria-label="Мазмұн бөлімдері">{dynamicContentKinds.map((kind) => <a key={kind} href={`/dashboard/content/${kind}`} aria-current={rawKind === kind ? "page" : undefined}>{dynamicContentMeta[kind].plural}</a>)}</nav>
    <div className="dash-page-heading"><div><p>Динамикалық мазмұн</p><h1>{meta.plural}</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Аудит қосылған</span></div>
    <CatalogViews base={base} state={state} creating={creating} label={`${meta.singular} қосу`} />
    {state.error && <div className="dash-alert error">Материал сақталмады. Міндетті өрістерді, сілтемені және сурет өлшемін тексеріңіз.</div>}
    {creating ? <section className="panel dynamic-create-panel"><div className="panel-heading"><div><span>Жаңа жоба</span><h2><Plus size={17} /> {meta.singular} қосу</h2></div></div><DynamicContentForm kind={rawKind} action={`/api/content/${rawKind}`} submitLabel="Жобаны сақтау" /></section> : (<>
      <form className="event-filter" method="get"><label>Атауы бойынша іздеу<input name="q" type="search" defaultValue={state.q} /></label><button className="button">Іздеу</button>{state.q && <a href={base}>Тазарту</a>}</form>
      <section className="panel dynamic-list-panel"><div className="panel-heading"><div><span>Барлығы</span><h2>{items.length} жазба</h2></div><a href={meta.publicHref} target="_blank" rel="noreferrer">Ашық бетті көру</a></div>
        <div className="dynamic-admin-list">{items.map((item) => {
          const title = "title" in item ? item.title : item.name;
          return <a href={`/dashboard/content/${rawKind}/${item.id}`} key={item.id}><div><strong>{title}</strong><small>{"slug" in item ? `/${item.slug}` : item.websiteUrl ?? "Сілтемесіз"}</small></div><span className={`content-status ${item.status.toLowerCase()}`}>{dynamicStatusLabel(item.status)}</span></a>;
        })}{items.length === 0 && <p className="empty-content">{state.q ? "Осы атаумен материал табылмады." : "Әзірге жазба жоқ."}</p>}</div>
      </section>
    </>)}
  </main>;
}
