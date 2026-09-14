/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal public left-click navigation. */
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { defaultLocale, translate } from "@/lib/i18n";
import type { PublicContentValues } from "@/lib/public-content";
import { getPublicContentValues } from "@/db/queries";

const primaryLinks = [
  [translate(defaultLocale, "association"), "/about"],
  [translate(defaultLocale, "structure"), "/structure"],
  [translate(defaultLocale, "branches"), "/branches"],
  [translate(defaultLocale, "projects"), "/projects"],
  [translate(defaultLocale, "news"), "/news"],
] as const;

export async function PublicShell({ children, content: suppliedContent }: { children: React.ReactNode; content?: PublicContentValues }) {
  const content = suppliedContent ?? await getPublicContentValues();
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="Басты бет">
            <span className="brand-symbol">∑</span>
            <span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span>
          </a>
          <nav className="desktop-nav" aria-label="Негізгі навигация">
            {primaryLinks.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
          </nav>
          <div className="header-actions">
            <a className="login-link" href="/login">{translate(defaultLocale, "signIn")} <ArrowUpRight size={15} /></a>
            <a className="header-cta" href={content["home.hero.primaryDestination"]}>{content["home.hero.primaryLabel"]}</a>
            <details className="mobile-menu">
              <summary aria-label="Мәзірді ашу"><Menu size={22} /><ChevronDown size={14} /></summary>
              <nav>{primaryLinks.map(([label, href]) => <a href={href} key={href}>{label}</a>)}<a href="/login">Жүйеге кіру</a></nav>
            </details>
          </div>
        </div>
      </header>
      {children}
      <footer className="public-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <a className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span></a>
            <p>{content["footer.description"]}</p>
          </div>
          <div><strong>Қауымдастық</strong><a href="/about">Біз туралы</a><a href="/mission">Миссия</a><a href="/structure">Құрылым</a><a href="/partners">Серіктестер</a></div>
          <div><strong>Қызмет</strong><a href="/projects">Жобалар</a><a href="/events">Іс-шаралар</a><a href="/publications">Материалдар</a><a href="/news">Жаңалықтар</a></div>
          <div><strong>Байланыс</strong><a href={content["footer.contactDestination"]}>{content["footer.contactLabel"]}</a><a href={content["home.hero.primaryDestination"]}>Мүше болу</a><a href="/login">Ішкі жүйе</a></div>
        </div>
        <div className="container footer-bottom"><span>© 2026 Республикалық математиктер бірлестігі.</span><span>Қазақша · RU · EN</span></div>
      </footer>
    </div>
  );
}
