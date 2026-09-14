/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal dashboard left-click navigation. */
import { BookOpen, FilePenLine, FolderKanban, Handshake, Newspaper, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicContentValues } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canManageDynamicContent, canManagePublicContent } from "@/lib/authorization";
import { publicContentDefinitions } from "@/lib/public-content";

export default async function PublicContentPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  const fixedAccess = canManagePublicContent(actor);
  const dynamicAccess = canManageDynamicContent(actor);
  if (!fixedAccess && !dynamicAccess) notFound();
  const [values, state] = await Promise.all([getPublicContentValues(), searchParams]);
  const sections = Map.groupBy(publicContentDefinitions, (definition) => definition.section);

  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Ашық сайтты басқару</p><h1>Сайт мазмұны</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> Құрылым қорғалған</span></div>
    {state.success && <div className="dash-alert success">Мазмұн сақталды, жарияланды және аудит журналына тіркелді.</div>}
    {state.error && <div className="dash-alert error">Мазмұн сақталмады. Мәтін мен сілтемелерді тексеріңіз.</div>}
    {dynamicAccess && <section className="dynamic-content-catalog">
      <a href="/dashboard/content/news"><Newspaper size={23} /><div><strong>Жаңалықтар</strong><small>Жоба, жариялау және архив</small></div></a>
      <a href="/dashboard/content/publications"><BookOpen size={23} /><div><strong>Жарияланымдар</strong><small>Материалдар және қауіпсіз сілтемелер</small></div></a>
      <a href="/dashboard/content/partners"><Handshake size={23} /><div><strong>Серіктестер</strong><small>Логотип, реттік орын және көріну</small></div></a>
      <a href="/dashboard/content/projects"><FolderKanban size={23} /><div><strong>Ашық жобалар</strong><small>Қоғамдық ақпарат қабаты</small></div></a>
    </section>}
    {fixedAccess && <>
    <div className="content-admin-note"><FilePenLine size={22} /><p>Бұл бөлім тек мәтіндерді, батырма белгілерін және қауіпсіз сілтемелерді өзгертеді. Бет құрылымы, стиль, код және қолданба логикасы өзгертілмейді.</p></div>
    <form className="content-admin-form" action="/api/public-content" method="post">
      {[...sections.entries()].map(([section, definitions]) => <section className="panel content-admin-section" key={section}>
        <div className="panel-heading"><div><span>Жария мазмұн</span><h2>{section}</h2></div></div>
        <div className="content-field-grid">
          {definitions.map((definition) => <label className={definition.kind === "textarea" ? "content-field-wide" : ""} key={definition.key}>
            <span>{definition.label}</span>
            {definition.kind === "textarea"
              ? <textarea name={definition.key} defaultValue={values[definition.key]} required maxLength={definition.maxLength} rows={4} />
              : <input name={definition.key} defaultValue={values[definition.key]} required maxLength={definition.maxLength} inputMode={definition.kind === "destination" ? "url" : "text"} />}
            <small>{definition.kind === "destination" ? "Ішкі /жол немесе қауіпсіз http(s) сілтемесі" : `${definition.maxLength} таңбаға дейін`}</small>
          </label>)}
        </div>
      </section>)}
      <div className="content-publish-bar"><p>Әр өзгерген өріс алдыңғы және жаңа мәнімен бірге өшірілмейтін аудит журналында сақталады.</p><button className="button button-primary" type="submit">Сақтау және жариялау</button></div>
    </form>
    </>}
  </main>;
}
