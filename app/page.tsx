/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Public routes use native navigation and local or uploaded illustrations. */
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PublicShell } from "./components/PublicShell";
import { getPublicContentValues } from "@/db/queries";
import { getHomeStory } from "@/db/home-feature";
import { getNearestUpcomingEvent } from "@/db/events";
import { eventLocation, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { squareMaterial } from "@/lib/club-material";

export const dynamic = "force-dynamic";
const routes = [
  ["/events", "Кездесулер", "Қашан, қайда өтетінін және қалай қатысуға болатынын қараңыз."],
  ["/branches", "Өңірдегі филиалдар", "Өз қалаңыздағы немесе облысыңыздағы филиалды табыңыз."],
  ["/publications", "Әдістемелік материалдар", "Сабаққа, үйірмеге және өз бетіңізше жұмыс істеуге арналған қор."],
];

export default async function Home() {
  const [content, story, event] = await Promise.all([getPublicContentValues(), getHomeStory(), getNearestUpcomingEvent()]);
  const item = story ?? squareMaterial;
  const image = story ? (story.coverMediaId ? "/api/public-media/" + story.coverMediaId : null) : squareMaterial.image;
  return <PublicShell content={content}><main className="club-home"><div className="container">
    <p className="club-intro">{content["home.hero.intro"]}</p>
    <section className={"club-feature" + (image ? "" : " text-only")}>
      <div><p className="club-kicker">{story?.section ?? "Есеп талқысы"}</p><h1>{item.title}</h1><p className="club-summary">{item.summary}</p>
      <div className="club-actions"><a className="club-button" href={item.href}>{story ? "Толық оқу" : "Есепті ашу"} <ArrowRight size={17}/></a><a href="/publications">Барлық материал</a></div></div>
      {image && <img className="club-cover" src={image} alt={story ? "" : squareMaterial.alt} />}
    </section>
    {event && <section className="club-event"><div><p className="club-kicker">Алдағы кездесу</p><h2>{event.title}</h2><p>{formatDate(event.startAt.toISOString(), true)} · {eventLocation(event)}{event.status === "POSTPONED" && " · " + eventStatusLabel(event.status)}</p></div><a className="club-button" href={"/events/" + event.slug}>Кездесу туралы <ArrowRight size={17}/></a></section>}
    <section className="club-paths"><h2>Бірлестікте не бар?</h2><div>{routes.map(([href, title, description]) => <a key={href} href={href}><strong>{title}<ArrowUpRight size={19}/></strong><p>{description}</p></a>)}</div></section>
    </div><section className="club-about"><div className="container"><h2>Бірлестік туралы</h2><nav aria-label="Бірлестік туралы ақпарат"><a href="/about">Біз туралы</a><a href="/structure">Басшылық</a><a href="/partners">Серіктестер</a><a href="/membership/terms">Мүшелік шарттары</a></nav></div></section>
    </main></PublicShell>;
}
