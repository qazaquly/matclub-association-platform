/* eslint-disable @next/next/no-img-element -- Logos come from the audited public-media route and have no static dimensions. */
import { ExternalLink } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { listActivePartners } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const items = await listActivePartners();
  return <PublicShell><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">Серіктестер</p><h1>Ортақ құндылыққа негізделген ынтымақтастық</h1><p>Бірлестіктің академиялық, білім беру және қоғамдық серіктестері.</p></div></section><section className="section container"><div className="partner-public-grid">{items.map((item) => <article key={item.id}>{item.logoMediaId ? <img src={`/api/public-media/${item.logoMediaId}`} alt={`${item.name} логотипі`} /> : <span>{item.name.slice(0, 1)}</span>}<h2>{item.name}</h2><p>{item.description}</p>{item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noreferrer">Сайтқа өту <ExternalLink size={14} /></a>}</article>)}{items.length === 0 && <div className="public-empty-state"><h2>Серіктестер тізімі дайындалып жатыр</h2></div>}</div></section></main></PublicShell>;
}
