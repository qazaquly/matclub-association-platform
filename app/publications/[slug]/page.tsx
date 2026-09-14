/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Vinext navigation and database-backed media require native elements here. */
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/app/components/PublicShell";
import { SafeMarkdown } from "@/app/components/SafeMarkdown";
import { getPublishedPublication } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function PublicationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPublishedPublication((await params).slug);
  if (!item) notFound();
  return <PublicShell><main><section className="article-hero"><div className="container narrow"><a href="/publications"><ArrowLeft size={15} /> Жарияланымдар</a><p className="eyebrow">Жарияланым</p><h1>{item.title}</h1><p>{item.summary}</p><small>{item.publicationDate?.toLocaleDateString("kk-KZ")}{item.authorText ? ` · ${item.authorText}` : ""}</small></div></section>{item.coverMediaId && <div className="container narrow article-cover"><img src={`/api/public-media/${item.coverMediaId}`} alt={item.title} /></div>}<article className="section container article-body"><SafeMarkdown source={item.body} />{item.resourceUrl && <a className="button button-primary article-resource" href={item.resourceUrl} target="_blank" rel="noreferrer">Материалды ашу <ExternalLink size={16} /></a>}</article></main></PublicShell>;
}
