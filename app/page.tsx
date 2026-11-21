/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Use native public navigation and locally served or uploaded photographs. */
import { ArrowRight, ArrowUpRight, Instagram, LogIn } from "lucide-react";
import { getPublicContentValues } from "@/db/queries";
import { getHomeStory } from "@/db/home-feature";
import { listHomeEvents } from "@/db/events";
import { getHomeCatalog } from "@/db/public-cms";
import { getCurrentUser } from "@/lib/auth";
import { squareMaterial } from "@/lib/club-material";
import { eventLocation, eventStatusLabel } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { kurshimReport } from "@/lib/regional-news";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

const calendar = "/events?view=calendar&period=upcoming";
const profile = "https://www.instagram.com/yrysbek.mauit/";
const photoCredit = "https://mail.umcdo.edu.kz/kz/zhanalyktar/ortalyq_zhanalyqtary?page=20&title=%C2%ABoy-sandyik%C2%BB_oku_jane_matematikalyik_sauattyilyiktan_ziyatkerlyik_baykauyinyin_oblyistyik_kezenyi_ottyi_571";
const media = (id: string | null) => id ? "/api/public-media/" + id : undefined;
const footerLinks = [["Бірлестік туралы", "/about"], ["Басшылық пен құрылым", "/structure"], ["Материалдар", "/publications"], ["Мүшелік шарттары", "/membership/terms"], ["Байланыс", "/contact"]];

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className={styles.link} href={href}>{children}<ArrowUpRight aria-hidden="true" /></a>;
}

function Blog() {
  return <aside aria-labelledby="blog-title">
    <a className={styles.blog} href={profile} target="_blank" rel="noopener noreferrer" aria-label="Ырысбек Мәуіттің блогын Instagram-да оқу (жаңа қойынды)">
      <div className={styles.blogId}>
        <img src="/home/yrysbek-mauit.png" alt="" width="78" height="78" />
        <div><h2 id="blog-title">Ырысбек Мәуіттің блогы</h2><span>@yrysbek.mauit</span></div>
      </div>
      <p>Есеп шығару, сабақ беру және олимпиадаға дайындық туралы.</p>
      <span className={styles.blogAction}><Instagram aria-hidden="true" />Instagram-да оқу<ArrowUpRight aria-hidden="true" /></span>
    </a>
  </aside>;
}

type ResourceCard = { href: string; title: string; summary: string; label: string; image?: string };
type NewsCard = { href: string; title: string; summary: string; date: string; image?: string; regional?: boolean };

function ProjectCards({ items }: { items: ResourceCard[] }) {
  return <div className={styles.projects}>{items.map(item =>
    <a className={styles.project} href={item.href} key={item.href}>
      {item.image && <img src={item.image} alt="" width="220" height="124" loading="lazy" />}
      <div className={styles.projectCopy}><small>{item.label}</small><h3>{item.title}</h3><p>{item.summary}</p></div>
      <ArrowRight aria-hidden="true" />
    </a>
  )}</div>;
}

function PhotoNews({ lead, briefs, recommended }: { lead: NewsCard; briefs: NewsCard[]; recommended?: ResourceCard }) {
  const sideColumn = briefs.length > 0 || Boolean(recommended);
  return <section className={styles.section} id="news" aria-labelledby="news-title">
    <div className={styles.sectionHeading}><h2 id="news-title">Соңғы жаңалықтар</h2><SectionLink href="/news">Барлық жаңалық</SectionLink></div>
    <div className={sideColumn ? styles.editorial : styles.singleStory}>
      <article>
        <a className={styles.photoStory} href={lead.href} target={lead.regional ? "_blank" : undefined} rel={lead.regional ? "noopener noreferrer" : undefined}>
          {lead.image && <img src={lead.image} alt={lead.regional ? kurshimReport.alt : ""} width="960" height="540" loading="lazy" />}
          <div className={styles.storyCopy}><span className={styles.meta}><time dateTime={lead.date}>{formatDate(lead.date)}</time>{lead.regional && " · Күршім"}</span>
            <h3>{lead.title}</h3><p>{lead.summary}</p><span className={styles.readMore}>Толық оқу<ArrowUpRight aria-hidden="true" /></span>
            {lead.regional && <small className={styles.credit}>Фото және ақпарат — {kurshimReport.source}.</small>}
          </div>
        </a>
      </article>
      {sideColumn && <div className={styles.briefs}>
        {briefs.length > 0 && <><h3>Басқа жаңалықтар</h3><div className={styles.briefList}>{briefs.map(item =>
          <a href={item.href} key={item.href}><div><time dateTime={item.date}>{formatDate(item.date)}</time><strong>{item.title}</strong></div><ArrowRight aria-hidden="true" /></a>
        )}</div></>}
        {recommended && <div><h3>Оқуға ұсынамыз</h3><div className={styles.briefList}><a href={recommended.href}><strong>{recommended.title}</strong><ArrowRight aria-hidden="true" /></a></div></div>}
      </div>}
    </div>
  </section>;
}

export default async function Home() {
  const [content, catalog, events, featured, user] = await Promise.all([
    getPublicContentValues(), getHomeCatalog(), listHomeEvents(), getHomeStory(), getCurrentUser(),
  ]);
  const cabinet = Boolean(user && user.membershipStatus !== "registered_user");
  const slogan = content["home.hero.slogan"].match(/^(.+?[.!?])\s+(.+)$/u);
  const firstLine = slogan?.[1] ?? content["home.hero.slogan"];
  const secondLine = slogan?.[2];
  const projects: ResourceCard[] = catalog.projects.map(item => ({ href: "/projects/" + item.slug, title: item.title, summary: item.summary, label: "Бірлестік жобасы", image: media(item.coverMediaId) }));
  const news: NewsCard[] = catalog.news.map(item => ({ href: "/news/" + item.slug, title: item.title, summary: item.lead, date: item.publishedAt!.toISOString(), image: media(item.coverMediaId) }));
  const pinned: ResourceCard | undefined = featured ? { href: featured.href, title: featured.title, summary: featured.summary, label: featured.section, image: media(featured.coverMediaId) } : undefined;
  const projectCards = featured?.kind === "projects" && pinned ? [pinned, ...projects.filter(item => item.href !== pinned.href)].slice(0, 2) : projects;
  const newsCards = featured?.kind === "news" && pinned ? [{ ...pinned, date: featured.publishedAt!.toISOString() }, ...news.filter(item => item.href !== pinned.href)].slice(0, 3) : news;
  const reading = featured?.kind === "publications" ? pinned : undefined;
  const resources: ResourceCard[] = [
    reading ?? { ...squareMaterial, image: "/home/sabaq.jpg", label: "Сабаққа арналған материал" },
    { href: "/branches", title: "Өз өңіріңіздегі филиал", label: "Өңірлік жұмыс", summary: "Өңіріңізді таңдап, жергілікті кездесулердің күнтізбесін ашыңыз.", image: "/home/onir.jpg" },
  ];
  const [lead = { ...kurshimReport, regional: true }, ...briefs] = newsCards;
  return <div className={styles.home}>
    <a className={styles.skip} href="#main">Негізгі мазмұнға өту</a>
    <header className={styles.top}><div className={styles.wrap + " " + styles.header}>
      <a className={styles.brand} href="/" aria-label="Mathclub.kz басты беті"><img src="/home/logo.png" alt="" width="44" height="42" /><span><strong>Mathclub.kz</strong><small>Республикалық математиктер бірлестігі</small></span></a>
      <nav className={styles.nav} aria-label="Негізгі бөлімдер"><a href="#events">Іс-шаралар</a><a href={projectCards.length ? "#projects" : "/projects"}>Жобалар</a><a href="#news">Жаңалықтар</a><a href="/branches">Өңірлер</a></nav>
      <a className={styles.cabinet} href={user ? "/dashboard" : "/login"}>Жеке кабинет <LogIn aria-hidden="true" /></a>
    </div></header>
    <main id="main">
      <section className={styles.hero} aria-labelledby="slogan"><div className={styles.wrap + " " + styles.heroMain}>
        <div className={styles.heroCopy}><h1 id="slogan">{firstLine}{secondLine && <span>{secondLine}</span>}</h1><p>{content["home.hero.intro"]}</p>
          <div className={styles.actions}><a className={styles.warmButton} href={cabinet ? "/dashboard" : content["home.hero.primaryDestination"]}>{cabinet ? "Жеке кабинетке өту" : content["home.hero.primaryLabel"]}<ArrowRight aria-hidden="true" /></a>
            <a className={styles.outlineButton} href={content["home.hero.secondaryDestination"]}>{content["home.hero.secondaryLabel"]}</a></div>
        </div>
        <figure className={styles.heroPhoto}><img src="/home/oi-sandyq.jpg" width="960" height="1280" fetchPriority="high" alt="Маңғыстаудағы «Ой-сандық» байқауында мұғалімдер бірге тапсырма орындап отыр." /><figcaption>Маңғыстау, «Ой-сандық» байқауы · <a href={photoCredit}>Фото дереккөзі</a></figcaption></figure>
      </div></section>
      <div className={styles.facts}><div className={styles.wrap + " " + styles.factRow}>
        <a className={styles.fact} href="/branches"><strong>{catalog.branchCount}</strong> өңірлік филиал</a>
        <a className={styles.fact} href="/projects"><strong>{catalog.projectCount}</strong> жарияланған жоба</a>
        <SectionLink href="/membership/terms">Мүшелік шарттары</SectionLink>
      </div></div>
      <div className={styles.wrap + " " + styles.content}>
        <div className={styles.activities}><section id="events" aria-labelledby="events-title">
          <div className={styles.sectionHeading}><h2 id="events-title">Алдағы іс-шаралар</h2><SectionLink href={calendar}>Күнтізбе</SectionLink></div>
          <div className={styles.eventList}>{events.map(item => {
            const date = item.startAt.toISOString();
            const [label, hour] = formatDate(date, true).split(", ");
            const [day, month] = label.split(" ");
            return <a className={styles.event} href={"/events/" + item.slug} key={item.id}>
              <time className={styles.eventDate} dateTime={date} aria-label={label}><b>{day.padStart(2, "0")}</b><small>{month}</small></time>
              <div className={styles.eventCopy}><h3>{item.title}</h3><p>{item.summary}</p></div>
              <div className={styles.eventWhere}>{eventLocation(item)}<small>{hour}, Астана уақыты{item.status === "POSTPONED" && " · " + eventStatusLabel(item.status)}</small></div><ArrowRight aria-hidden="true" />
            </a>;
          })}{!events.length && <p className={styles.eventEmpty}>Алдағы іс-шаралар әзірге жарияланған жоқ.</p>}</div>
        </section><Blog /></div>
        <section className={styles.section} id="projects" aria-labelledby="projects-title"><div className={styles.sectionHeading}>
          <h2 id="projects-title">{projectCards.length ? content["home.projects.heading"] : "Қазір не көруге болады?"}</h2><SectionLink href={content["home.projects.ctaDestination"]}>{content["home.projects.ctaLabel"]}</SectionLink>
        </div><ProjectCards items={projectCards.length ? projectCards : resources} /></section>
        <PhotoNews lead={lead} briefs={briefs} recommended={projectCards.length ? reading : undefined} />
        <section className={styles.join} aria-labelledby="join-title"><div><h2 id="join-title">{content["home.membership.heading"]}</h2><p>{content["home.membership.intro"]}</p></div>
          <a className={styles.navyButton} href={cabinet ? "/dashboard" : content["home.membership.ctaDestination"]}>{cabinet ? "Жеке кабинетке өту" : content["home.membership.ctaLabel"]}<ArrowRight aria-hidden="true" /></a>
        </section>
      </div>
    </main>
    <footer className={styles.footer}><div className={styles.wrap + " " + styles.foot}><p>Республикалық математиктер бірлестігі</p><nav aria-label="Бірлестік туралы">{footerLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav></div></footer>
  </div>;
}
