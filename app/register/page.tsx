/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta requires browser-native navigation. */
import type { Metadata } from "next";
import { ArrowLeft, UserPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegistrationForm } from "./RegistrationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Тіркелгі жасау" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.emailVerifiedAt ? (user.membershipStatus === "registered_user" ? "/membership" : "/dashboard") : "/verify-email");
  return <main className="login-page"><div className="login-brand"><a className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span></a><div><p className="eyebrow">Бір тұрақты профиль</p><h1>Алдымен қауіпсіз тіркелгі жасаңыз.</h1><p>Аккаунт тіркеу мен мүшелікке өтініш беру — екі бөлек процесс.</p></div><span className="login-formula"><UserPlus size={54} /></span></div><div className="login-panel"><a className="back-link" href="/"><ArrowLeft size={16} /> Ресми сайтқа оралу</a><RegistrationForm /><p className="auth-alternative">Тіркелгіңіз бар ма? <a href="/login">Жүйеге кіріңіз</a></p></div></main>;
}
