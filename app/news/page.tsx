/* eslint-disable @next/next/no-img-element -- Images come from the audited public-media route and have no static dimensions. */
import { ArrowRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { listPublishedNews } from "@/db/public-cms";
import { kurshimReport } from "@/lib/regional-news";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const items = await listPublishedNews();
  return <PublicShell><main>
    <section className="page-hero"><div className="container narrow"><p className="eyebrow">Жаңалықтар</p><h1>Бірлестік тынысы</h1><p>Ресми хабарлар, кәсіби бастамалар және бірлестік өміріндегі маңызды жаңалықтар.</p></div></section>
    <section className="section container"><div className="public-content-grid">{items.map((item) => <article className="public-content-card" key={item.id}>
      {item.coverMediaId && <img src={`/api/public-media/${item.coverMediaId}`} alt="" />}
      <div><small><CalendarDays size={13} /> {item.publishedAt?.toLocaleDateString("kk-KZ")}</small><h2>{item.title}</h2><p>{item.lead}</p><a href={`/news/${item.slug}`}>Толық оқу <ArrowRight size={15} /></a></div>
    </article>)}{items.length === 0 && <article className="public-content-card">
      <img src={kurshimReport.image} alt={kurshimReport.alt} />
      <div><small><CalendarDays size={13} /> {formatDate(kurshimReport.date)} · Өңір жаңалығы</small>
        <h2>{kurshimReport.title}</h2><p>{kurshimReport.summary}</p>
        <a href={kurshimReport.href} target="_blank" rel="noopener noreferrer">{kurshimReport.source} <ArrowUpRight size={15} /></a>
      </div>
    </article>}</div></section>
  </main></PublicShell>;
}
