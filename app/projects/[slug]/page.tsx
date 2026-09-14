/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Vinext navigation and database-backed media require native elements here. */
import { ArrowLeft, CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicShell } from "@/app/components/PublicShell";
import { SafeMarkdown } from "@/app/components/SafeMarkdown";
import { getPublishedProject } from "@/db/public-cms";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getPublishedProject((await params).slug);
  if (!item) notFound();
  const dates = [item.publicStartDate?.toLocaleDateString("kk-KZ"), item.publicEndDate?.toLocaleDateString("kk-KZ")].filter(Boolean).join(" — ");
  return <PublicShell><main><section className="article-hero"><div className="container narrow"><a href="/projects"><ArrowLeft size={15} /> Жобалар</a><p className="eyebrow">Ашық жоба</p><h1>{item.title}</h1><p>{item.summary}</p>{dates && <small><CalendarDays size={14} /> {dates}</small>}</div></section>{item.coverMediaId && <div className="container narrow article-cover"><img src={`/api/public-media/${item.coverMediaId}`} alt={item.title} /></div>}<article className="section container article-body"><SafeMarkdown source={item.body} /></article></main></PublicShell>;
}
