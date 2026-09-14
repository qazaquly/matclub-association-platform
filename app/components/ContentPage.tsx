import { ArrowRight } from "lucide-react";
import { PublicShell } from "./PublicShell";
import { getPublicContentValues } from "@/db/queries";

export interface ContentBlock {
  kicker?: string;
  title: string;
  text: string;
}

export async function ContentPage({
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
  const content = await getPublicContentValues();
  return (
    <PublicShell content={content}>
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
        {cta && <section className="container compact-cta"><div><span>{content["common.cta.eyebrow"]}</span><h2>{content["common.cta.heading"]}</h2></div><a className="button button-primary" href={content["common.cta.destination"]}>{content["common.cta.label"]} <ArrowRight size={18} /></a></section>}
      </main>
    </PublicShell>
  );
}
