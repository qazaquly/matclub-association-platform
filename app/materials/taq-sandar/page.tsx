/* eslint-disable @next/next/no-img-element -- The diagram is a local vector illustration. */
import { PublicShell } from "@/app/components/PublicShell";
import { squareMaterial } from "@/lib/club-material";

export const metadata = { title: squareMaterial.title };
export default function SquareMaterialPage() {
  return <PublicShell><main className="club-reading"><div className="container narrow">
    <a href="/publications">← Барлық материал</a>
    <p className="club-kicker">Есеп талқысы</p><h1>{squareMaterial.title}</h1>
    <p>Алғашқы бес тақ санның қосындысын табыңыз. Келесі тақ санды қосқанда қандай шаршы шығады?</p>
    <img src={squareMaterial.image} alt={squareMaterial.alt} width="580" height="352" />
    <h2>Торларды санап көріңіз</h2><p>4 × 4 шаршының оң жағына төрт тор, астына бес тор қосыңыз. Сонда 16 торға тағы 9 тор қосылып, 5 × 5 шаршы шығады. Келесі шаршыға тағы 5 + 6 = 11 тор керек.</p>
    <h2>Екі шетінен қосыңыз</h2><p>1 мен 9-дың қосындысы — 10. 3 пен 7 де 10 береді. Ортада 5 қалады.</p><p className="club-equation">(1 + 9) + (3 + 7) + 5 = 25</p>
    <h2>Кез келген шаршы үшін</h2><p>Алғашқы n тақ санды өсу және кему ретімен бірінің астына бірін жазыңыз. Әр бағанның қосындысы 2n болады. Баған саны n болғандықтан, екі қатардың қосындысы 2n², ал бір қатардікі n² болады.</p>
  </div></main></PublicShell>;
}
