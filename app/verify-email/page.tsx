import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Электрондық поштаны растау" };

const messages: Record<string, string> = {
  sent: "Растау сілтемесі электрондық поштаңызға жіберілді.",
  verified: "Электрондық поштаңыз сәтті расталды.",
  invalid: "Растау сілтемесі жарамсыз, қолданылып қойған немесе мерзімі аяқталған.",
  "rate-limited": "Растау хатын қайта жіберу шегіне жеттіңіз. Кейінірек қайталап көріңіз.",
  unconfigured: "Email жеткізу провайдері әлі бапталмаған. Әкімші конфигурацияны аяқтаған соң хатты қайта жіберіңіз.",
  failed: "Растау хатын жіберу уақытша мүмкін болмады. Кейінірек қайталап көріңіз.",
  "invalid-email": "Электрондық пошта мекенжайын дұрыс енгізіңіз.",
  "email-in-use": "Бұл электрондық пошта басқа тіркелгіде қолданылып тұр.",
  "email-unchanged": "Жаңа электрондық пошта қазіргі мекенжайдан өзгеше болуы керек.",
  "email-updated": "Электрондық пошта түзетілді. Жаңа мекенжайға растау сілтемесі жіберілді.",
  "email-updated-unconfigured": "Электрондық пошта түзетілді. Email жеткізу провайдері бапталған соң растау хатын қайта жіберіңіз.",
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const [user, state] = await Promise.all([getCurrentUser(), searchParams]);
  const verified = Boolean(user?.emailVerifiedAt) || state.state === "verified";
  return <main className="simple-state-page"><section><MailCheck size={42} /><p className="eyebrow dark">Тіркелгі қауіпсіздігі</p><h1>{verified ? "Электрондық пошта расталды" : "Электрондық поштаңызды растаңыз"}</h1><p>{messages[state.state ?? ""] ?? (user ? `${user.email} мекенжайына жіберілген сілтемені ашыңыз.` : "Растау үшін алдымен жүйеге кіріңіз.")}</p>{verified ? <a className="button button-primary" href="/membership">Мүшелік өтінішіне өту</a> : user ? <div className="verification-actions"><form action="/api/auth/verification/resend" method="post"><button className="button button-secondary" type="submit">Растау хатын қайта жіберу</button></form><details><summary>Электрондық поштаны өзгерту</summary><form action="/api/auth/verification/email" method="post"><label>Дұрыс электрондық пошта<input type="email" name="email" required autoComplete="email" defaultValue={user.email} /></label><button className="button button-secondary" type="submit">Өзгерту және жаңа хат жіберу</button></form></details></div> : <a className="button button-primary" href="/login">Жүйеге кіру</a>}</section></main>;
}
