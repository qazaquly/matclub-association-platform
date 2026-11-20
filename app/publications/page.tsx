/* eslint-disable @next/next/no-img-element -- Images come from the audited public-media route and have no static dimensions. */
import { ArrowRight, BookOpen } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { squareMaterial } from "@/lib/club-material";
import { listPublishedPublications } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function PublicationsPage() {
  const items = await listPublishedPublications();
  return <PublicShell><main>
    <section className="page-hero"><div className="container narrow"><p className="eyebrow">Жарияланымдар</p><h1>Әдістемелік және кәсіби материалдар</h1><p>Бірлестік дайындаған және ұсынған материалдарды осы жерден оқи аласыз.</p></div></section>
    <section className="section container"><div className="public-content-grid">{items.map((item) => <article className="public-content-card" key={item.id}>{item.coverMediaId && <img src={`/api/public-media/${item.coverMediaId}`} alt="" />}<div><small><BookOpen size={13} /> {item.publicationDate?.toLocaleDateString("kk-KZ") ?? "Жарияланым"}</small><h2>{item.title}</h2><p>{item.summary}</p><a href={`/publications/${item.slug}`}>Материалды ашу <ArrowRight size={15} /></a></div></article>)}<article className="public-content-card"><img src={squareMaterial.image} alt={squareMaterial.alt}/><div><small>Есеп талқысы</small><h2>{squareMaterial.title}</h2><p>{squareMaterial.summary}</p><a href={squareMaterial.href}>Есепті ашу <ArrowRight size={15}/></a></div></article></div></section>
  </main></PublicShell>;
}
