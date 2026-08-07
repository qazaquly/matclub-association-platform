import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { defaultLocale, translate } from "@/lib/i18n";

const primaryLinks = [
  [translate(defaultLocale, "association"), "/about"],
  [translate(defaultLocale, "structure"), "/structure"],
  [translate(defaultLocale, "branches"), "/branches"],
  [translate(defaultLocale, "projects"), "/projects"],
  [translate(defaultLocale, "news"), "/news"],
] as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Басты бет">
            <span className="brand-symbol">∑</span>
            <span><strong>ҚМРҚ</strong><small>Қазақстан математиктерінің<br />республикалық қауымдастығы</small></span>
          </Link>
          <nav className="desktop-nav" aria-label="Негізгі навигация">
            {primaryLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </nav>
          <div className="header-actions">
            <Link className="login-link" href="/login">{translate(defaultLocale, "signIn")} <ArrowUpRight size={15} /></Link>
            <Link className="header-cta" href="/membership">{translate(defaultLocale, "becomeMember")}</Link>
            <details className="mobile-menu">
              <summary aria-label="Мәзірді ашу"><Menu size={22} /><ChevronDown size={14} /></summary>
              <nav>{primaryLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}<Link href="/login">Жүйеге кіру</Link></nav>
            </details>
          </div>
        </div>
      </header>
      {children}
      <footer className="public-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>ҚМРҚ</strong><small>Кәсіби математикалық<br />қауымдастық</small></span></Link>
            <p>Қазақстан математиктерін біріктіретін заманауи институционалдық кеңістік.</p>
          </div>
          <div><strong>Қауымдастық</strong><Link href="/about">Біз туралы</Link><Link href="/mission">Миссия</Link><Link href="/structure">Құрылым</Link><Link href="/partners">Серіктестер</Link></div>
          <div><strong>Қызмет</strong><Link href="/projects">Жобалар</Link><Link href="/events">Іс-шаралар</Link><Link href="/publications">Материалдар</Link><Link href="/news">Жаңалықтар</Link></div>
          <div><strong>Байланыс</strong><Link href="/contact">Хабарласу</Link><Link href="/membership">Мүше болу</Link><Link href="/login">Ішкі жүйе</Link></div>
        </div>
        <div className="container footer-bottom"><span>© 2026 ҚМРҚ. Барлық құқық қорғалған.</span><span>Қазақша · RU · EN</span></div>
      </footer>
    </div>
  );
}
