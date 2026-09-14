/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Vinext navigation and database-backed media require native elements here. */
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/app/components/PublicShell";
import { SafeMarkdown } from "@/app/components/SafeMarkdown";
import { getPublishedNews } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPublishedNews((await params).slug);
  if (!item) notFound();
  const relatedEvent = item.eventLinks.find((link) => link.event.publishedAt && !link.event.archivedAt);
  return <PublicShell><main>
    <section className="article-hero"><div className="container narrow"><a href="/news"><ArrowLeft size={15} /> Жаңалықтар</a><p className="eyebrow">Жаңалық</p><h1>{item.title}</h1><p>{item.lead}</p><small><CalendarDays size={14} /> {item.publishedAt?.toLocaleDateString("kk-KZ")}{item.authorText ? ` · ${item.authorText}` : ""}</small></div></section>
    {item.coverMediaId && <div className="container narrow article-cover"><img src={`/api/public-media/${item.coverMediaId}`} alt={item.title} /></div>}
    <article className="section container article-body"><SafeMarkdown source={item.body} />{relatedEvent && <a className="article-event-link" href={`/events/${relatedEvent.event.slug}`}>Қатысты іс-шара: {relatedEvent.event.title} <ArrowRight size={15} /></a>}</article>
  </main></PublicShell>;
}
