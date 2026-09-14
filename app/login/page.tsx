/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta client routing breaks normal public left-click navigation. */
import type { Metadata } from "next";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PasswordInput } from "@/app/components/PasswordInput";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ішкі жүйеге кіру" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const current = await getCurrentUser();
  if (current) redirect(!current.emailVerifiedAt ? "/verify-email" : current.membershipStatus === "registered_user" ? "/membership" : "/dashboard");
  const { error, reset } = await searchParams;
  return <main className="login-page"><div className="login-brand"><a className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span></a><div><p className="eyebrow">Қауіпсіз кеңістік</p><h1>Бірлестіктің институционалдық жады осында сақталады.</h1><p>Рөлге және жауапкершілік аумағына негізделген қолжетімділік әр пайдаланушыға тек қажетті деректі көрсетеді.</p></div><span className="login-formula">∑ · ∫ · ∞</span></div><div className="login-panel"><a className="back-link" href="/"><ArrowLeft size={16} /> Ресми сайтқа оралу</a><form action="/api/auth/login" method="post" className="login-form"><div className="login-icon"><LockKeyhole size={25} /></div><p className="eyebrow dark">Авторизация</p><h2>Жүйеге кіру</h2><p>Тіркелгіңіздің электрондық поштасы мен құпиясөзін енгізіңіз.</p>{reset === "success" && <div className="form-alert success">Құпиясөз жаңартылды. Енді жаңа құпиясөзбен кіріңіз.</div>}{error && <div className="form-alert">Кіру деректері дұрыс емес немесе уақытша шектеу қойылды.</div>}<label>Электрондық пошта<input type="email" name="email" required autoComplete="username" placeholder="name@example.test" /></label><PasswordInput label="Құпиясөз" name="password" autoComplete="current-password" /><a className="forgot-password-link" href="/forgot-password">Құпиясөзді ұмыттыңыз ба?</a><button className="button button-primary" type="submit">Кіру</button><small>Сессия қорғалған cookie арқылы басқарылады және 12 сағаттан кейін аяқталады.</small></form><p className="auth-alternative">Тіркелгіңіз жоқ па? <a href="/register">Тіркелгі жасаңыз</a></p></div></main>;
}
