/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal public left-click navigation. */
import { ArrowRight, BookOpen, Building2, CalendarDays, Network, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PublicShell } from "./components/PublicShell";
import { getPublicContentValues } from "@/db/queries";
import { getNearestUpcomingEvent } from "@/db/events";
import { eventLocation, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";

const priorities = [
  {
    icon: Users,
    number: "01",
    title: "Кәсіби бірлік",
    text: "Мұғалімдер, ғалымдар мен әдіскерлер бір-бірімен тәжірибе алмасады.",
  },
  {
    icon: Network,
    number: "02",
    title: "Өңірлік желі",
    text: "Әр филиал өз өңіріндегі математиктерді біріктіреді.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Мүшенің жеке кабинеті",
    text: "Қатысқан іс-шараларыңыз бен жобаларыңызды кабинеттен көре аласыз.",
  },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [content, nearestEvent, user] = await Promise.all([getPublicContentValues(), getNearestUpcomingEvent(), getCurrentUser()]);
  const cabinet = Boolean(user && user.membershipStatus !== "registered_user");
  const [sloganLead, ...sloganRest] = content["home.hero.slogan"].split(". ");
  return (
    <PublicShell content={content}>
      <main>
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow"><Sparkles size={15} /> {content["home.hero.headline"]}</p>
              <h1>{sloganLead}{sloganRest.length > 0 ? "." : ""}{sloganRest.length > 0 && <><br /><em>{sloganRest.join(". ")}</em></>}</h1>
              <p className="hero-lead">{content["home.hero.intro"]}</p>
              <div className="hero-actions">
                <a className="button button-primary" href={cabinet ? "/dashboard" : content["home.hero.primaryDestination"]}>
                  {cabinet ? "Жеке кабинетке өту" : content["home.hero.primaryLabel"]} <ArrowRight size={18} />
                </a>
                <a className="button button-ghost" href={content["home.hero.secondaryDestination"]}>{content["home.hero.secondaryLabel"]}</a>
              </div>
            </div>
            <div className="hero-mark" aria-hidden="true">
              <span className="formula formula-one">∫</span>
              <span className="formula formula-two">π</span>
              <span className="formula formula-three">∞</span>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-monogram">ҚМ</div>
            </div>
          </div>

        </section>

        <section className="section container">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow dark">Бірлестік туралы</p>
              <h2>{content["home.about.heading"]}</h2>
            </div>
            <p>{content["home.about.intro"]}</p>
          </div>
          <div className="priority-grid">
            {priorities.map(({ icon: Icon, number, title, text }) => (
              <article className="priority-card" key={number}>
                <div className="card-top"><span>{number}</span><Icon size={24} /></div>
                <h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="structure-section">
          <div className="container structure-grid">
            <div>
              <p className="eyebrow">Құрылым</p>
              <h2>{content["home.structure.heading"]}</h2>
              <p className="structure-copy">{content["home.structure.intro"]}</p>
              <a className="text-link light" href={content["home.structure.ctaDestination"]}>{content["home.structure.ctaLabel"]} <ArrowRight size={17} /></a>
            </div>
            <div className="org-map" aria-label="Бірлестік құрылымы">
              <div className="org-node primary"><span>01</span><strong>Президент</strong><small>Стратегиялық басқару</small></div>
              <div className="org-connector" />
              <div className="org-row">
                <div className="org-node"><span>02</span><strong>Вице-президенттер</strong><small>Бағыттарды үйлестіру</small></div>
                <div className="org-node"><span>03</span><strong>Департаменттер</strong><small>Кәсіби жұмыс</small></div>
                <div className="org-node"><span>04</span><strong>Филиалдар</strong><small>Өңірлік қызмет</small></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="section-heading inline-heading">
            <div><p className="eyebrow dark">Қызмет бағыттары</p><h2>{content["home.projects.heading"]}</h2></div>
            <a className="text-link" href={content["home.projects.ctaDestination"]}>{content["home.projects.ctaLabel"]} <ArrowRight size={17} /></a>
          </div>
          <div className="agenda-grid">
            <a href="/events" className="agenda-card featured">
              <CalendarDays size={26} /><span>Іс-шаралар</span>
              <h3>Кездесулер күнтізбесі</h3><ArrowRight size={20} />
            </a>
            <a href="/publications" className="agenda-card">
              <BookOpen size={26} /><span>Әдістемелік қор</span>
              <h3>Математикадан әдістемелік материалдар</h3><ArrowRight size={20} />
            </a>
            <a href="/branches" className="agenda-card">
              <Building2 size={26} /><span>Өңірлік жұмыс</span>
              <h3>Өз өңіріңіздегі филиалды табыңыз</h3><ArrowRight size={20} />
            </a>
          </div>
        </section>

        {nearestEvent && <section className="container nearest-event"><div><p className="eyebrow">Жақын іс-шара</p><h2>{nearestEvent.title}</h2><p>{nearestEvent.summary}</p></div><div className="nearest-event-meta"><span><CalendarDays size={17} /> {formatDate(nearestEvent.startAt.toISOString(), true)}</span><span>{eventLocation(nearestEvent)}</span><span>{eventStatusLabel(nearestEvent.status)}</span><a className="button button-white" href={`/events/${nearestEvent.slug}`}>Толық ақпарат <ArrowRight size={17} /></a></div></section>}

        {!cabinet && <section className="container membership-callout">
          <div>
            <p className="eyebrow">Бірлестікке қосылыңыз</p>
            <h2>{content["home.membership.heading"]}</h2>
          </div>
          <div>
            <p>{content["home.membership.intro"]}</p>
            <a className="button button-white" href={content["home.membership.ctaDestination"]}>{content["home.membership.ctaLabel"]} <ArrowRight size={18} /></a>
          </div>
        </section>}
      </main>
    </PublicShell>
  );
}
