import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ішкі жүйеге кіру" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return <main className="login-page"><div className="login-brand"><Link className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>ҚМРҚ</strong><small>Ішкі басқару жүйесі</small></span></Link><div><p className="eyebrow">Қауіпсіз кеңістік</p><h1>Қауымдастықтың институционалдық жады осында сақталады.</h1><p>Рөлге және жауапкершілік аумағына негізделген қолжетімділік әр пайдаланушыға тек қажетті деректі көрсетеді.</p></div><span className="login-formula">∑ · ∫ · ∞</span></div><div className="login-panel"><Link className="back-link" href="/"><ArrowLeft size={16} /> Ресми сайтқа оралу</Link><form action="/api/auth/login" method="post" className="login-form"><div className="login-icon"><LockKeyhole size={25} /></div><p className="eyebrow dark">Авторизация</p><h2>Жүйеге кіру</h2><p>Қызметтік электрондық пошта мен құпиясөзді енгізіңіз.</p>{error && <div className="form-alert">Кіру деректері дұрыс емес немесе уақытша шектеу қойылды.</div>}<label>Электрондық пошта<input type="email" name="email" required autoComplete="username" placeholder="name@ramk.kz" /></label><label>Құпиясөз<input type="password" name="password" required autoComplete="current-password" /></label><button className="button button-primary" type="submit">Кіру</button><small>Сессия қорғалған cookie арқылы басқарылады және 12 сағаттан кейін аяқталады.</small></form></div></main>;
}
