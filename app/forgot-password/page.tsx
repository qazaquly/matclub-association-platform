/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta requires browser-native navigation. */
import type { Metadata } from "next";
import { ArrowLeft, KeyRound } from "lucide-react";

export const metadata: Metadata = { title: "Құпиясөзді қалпына келтіру" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <main className="login-page"><div className="login-brand"><a className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span></a><div><p className="eyebrow">Қауіпсіз қалпына келтіру</p><h1>Құпиясөзді жаңарту.</h1><p>Бір реттік сілтеме тіркелгіңіздің электрондық поштасына жіберіледі.</p></div><span className="login-formula"><KeyRound size={54} /></span></div><div className="login-panel"><a className="back-link" href="/login"><ArrowLeft size={16} /> Кіру бетіне оралу</a><form action="/api/auth/forgot-password" method="post" className="login-form"><p className="eyebrow dark">Қалпына келтіру</p><h2>Электрондық поштаңызды енгізіңіз</h2>{state === "sent" && <div className="form-alert success">Егер бұл электрондық пошта тіркелген болса, қалпына келтіру сілтемесі жіберілді.</div>}<label>Электрондық пошта<input type="email" name="email" required autoComplete="email" /></label><button className="button button-primary" type="submit">Сілтемені жіберу</button><small>Қауіпсіздік үшін аккаунттың бар-жоғы ашық көрсетілмейді.</small></form></div></main>;
}
