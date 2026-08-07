import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "./PublicShell";

export interface ContentBlock {
  kicker?: string;
  title: string;
  text: string;
}

export function ContentPage({
  eyebrow,
  title,
  lead,
  blocks,
  cta = true,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  blocks: ContentBlock[];
  cta?: boolean;
}) {
  return (
    <PublicShell>
      <main>
        <section className="page-hero">
          <div className="container narrow"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{lead}</p></div>
        </section>
        <section className="section container narrow">
          <div className="content-blocks">
            {blocks.map((block, index) => (
              <article className="content-block" key={block.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>{block.kicker && <small>{block.kicker}</small>}<h2>{block.title}</h2><p>{block.text}</p></div>
              </article>
            ))}
          </div>
        </section>
        {cta && <section className="container compact-cta"><div><span>Қауымдастық мүшесі болыңыз</span><h2>Ортақ кәсіби кеңістікке қосылыңыз.</h2></div><Link className="button button-primary" href="/membership">Өтініш беру <ArrowRight size={18} /></Link></section>}
      </main>
    </PublicShell>
  );
}
