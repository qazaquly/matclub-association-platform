/* eslint-disable @next/next/no-img-element -- Images come from the audited public-media route and have no static dimensions. */
import { ArrowRight, FolderKanban } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { listPublishedProjects } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const items = await listPublishedProjects();
  return <PublicShell><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">Жобалар</p><h1>Кәсіби қоғамды күшейтетін бастамалар</h1><p>Бірлестіктің қоғамға ашық жобалары мен бастамалары. Ішкі жоба басқару үдерістері бұл бөлімге кірмейді.</p></div></section><section className="section container"><div className="public-content-grid">{items.map((item) => <article className="public-content-card" key={item.id}>{item.coverMediaId && <img src={`/api/public-media/${item.coverMediaId}`} alt="" />}<div><small><FolderKanban size={13} /> {item.publicStartDate?.toLocaleDateString("kk-KZ") ?? "Бірлестік жобасы"}</small><h2>{item.title}</h2><p>{item.summary}</p><a href={`/projects/${item.slug}`}>Жоба туралы <ArrowRight size={15} /></a></div></article>)}{items.length === 0 && <div className="public-empty-state"><h2>Жобалар дайындалып жатыр</h2><p>Жарияланған жобалар осы жерде көрсетіледі.</p></div>}</div></section></main></PublicShell>;
}
