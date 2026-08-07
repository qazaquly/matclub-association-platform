import Link from "next/link";
import { ArrowRight, BookOpen, Building2, CalendarDays, Network, ShieldCheck, Sparkles, Users } from "lucide-react";
import { PublicShell } from "./components/PublicShell";

const priorities = [
  {
    icon: Users,
    number: "01",
    title: "Кәсіби бірлік",
    text: "Математиктердің тәжірибесі, білімі мен бастамалары тоғысатын тұрақты орта.",
  },
  {
    icon: Network,
    number: "02",
    title: "Өңірлік желі",
    text: "Республикалық мақсат пен жергілікті жұмысты байланыстыратын ашық филиалдар жүйесі.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Институционалдық жады",
    text: "Әр мүшенің бір профилі және қауымдастықтағы қызметінің толық, үздіксіз тарихы.",
  },
];

export default function Home() {
  return (
    <PublicShell>
      <main>
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow"><Sparkles size={15} /> Қазақстанның кәсіби математикалық қауымдастығы</p>
              <h1>Математика — ортақ тіл.<br /><em>Қауымдастық — ортақ күш.</em></h1>
              <p className="hero-lead">
                Ғалымдарды, оқытушыларды және математикалық ойлауды дамытатын мамандарды
                бір институционалдық кеңістікке біріктіреміз.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/membership">
                  Бірлестікке мүше болу <ArrowRight size={18} />
                </Link>
                <Link className="button button-ghost" href="/about">Қауымдастық туралы</Link>
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
          <div className="container principle-strip">
            <span>Бір адам</span><i>→</i><span>бір профиль</span><i>→</i><span>біртұтас тарих</span>
          </div>
        </section>

        <section className="section container">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow dark">Біздің негіз</p>
              <h2>Математиктерді бүгін біріктіріп,<br />ертеңге мұра қалдырамыз.</h2>
            </div>
            <p>
              Қауымдастық кәсіби байланысты күшейтеді, өңірлік бастамаларды қолдайды және
              математикалық қоғамның ұзақ мерзімді институционалдық жадын қалыптастырады.
            </p>
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
              <h2>Ортақ мақсат.<br /><em>Айқын жауапкершілік.</em></h2>
              <p className="structure-copy">
                Президент, вице-президенттер, кәсіби департаменттер және өңірлік филиалдар
                бір басқару архитектурасында жұмыс істейді.
              </p>
              <Link className="text-link light" href="/structure">Ұйымдық құрылымды көру <ArrowRight size={17} /></Link>
            </div>
            <div className="org-map" aria-label="Қауымдастық құрылымы">
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
            <div><p className="eyebrow dark">Қызмет бағыттары</p><h2>Қауымдастық күн тәртібі</h2></div>
            <Link className="text-link" href="/projects">Барлық жобалар <ArrowRight size={17} /></Link>
          </div>
          <div className="agenda-grid">
            <Link href="/events" className="agenda-card featured">
              <CalendarDays size={26} /><span>Кәсіби кездесулер</span>
              <h3>Өңірлерді байланыстыратын ашық диалог алаңы</h3><ArrowRight size={20} />
            </Link>
            <Link href="/publications" className="agenda-card">
              <BookOpen size={26} /><span>Әдістемелік қор</span>
              <h3>Математикалық білім мен тәжірибе материалдары</h3><ArrowRight size={20} />
            </Link>
            <Link href="/branches" className="agenda-card">
              <Building2 size={26} /><span>Өңірлік жұмыс</span>
              <h3>Филиалдардың кәсіби бастамалары мен байланысы</h3><ArrowRight size={20} />
            </Link>
          </div>
        </section>

        <section className="container membership-callout">
          <div>
            <p className="eyebrow">Қауымдастыққа қосылыңыз</p>
            <h2>Кәсіби ортаға үлес қосатын кез келді.</h2>
          </div>
          <div>
            <p>Өтінішті онлайн жіберіңіз. Ол сіздің өңіріңіздегі филиалға автоматты түрде бағытталады.</p>
            <Link className="button button-white" href="/membership">Өтініш беру <ArrowRight size={18} /></Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
