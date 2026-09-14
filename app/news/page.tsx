/* eslint-disable @next/next/no-img-element -- Images come from the audited public-media route and have no static dimensions. */
import { ArrowRight, CalendarDays } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { listPublishedNews } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const items = await listPublishedNews();
  return <PublicShell><main>
    <section className="page-hero"><div className="container narrow"><p className="eyebrow">Жаңалықтар</p><h1>Бірлестік тынысы</h1><p>Ресми хабарлар, кәсіби бастамалар және бірлестік өміріндегі маңызды жаңалықтар.</p></div></section>
    <section className="section container"><div className="public-content-grid">{items.map((item) => <article className="public-content-card" key={item.id}>
      {item.coverMediaId && <img src={`/api/public-media/${item.coverMediaId}`} alt="" />}
      <div><small><CalendarDays size={13} /> {item.publishedAt?.toLocaleDateString("kk-KZ")}</small><h2>{item.title}</h2><p>{item.lead}</p><a href={`/news/${item.slug}`}>Толық оқу <ArrowRight size={15} /></a></div>
    </article>)}{items.length === 0 && <div className="public-empty-state"><h2>Жаңалықтар дайындалып жатыр</h2><p>Жарияланған материалдар осы жерде көрсетіледі.</p></div>}</div></section>
  </main></PublicShell>;
}
