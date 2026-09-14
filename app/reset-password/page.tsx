/* eslint-disable @next/next/no-html-link-for-pages -- Vinext beta requires browser-native navigation. */
import type { Metadata } from "next";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Жаңа құпиясөз" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <main className="login-page"><div className="login-brand"><a className="brand light-brand" href="/"><span className="brand-symbol">∑</span><span><strong>Республикалық математиктер</strong><small>бірлестігі</small></span></a><div><p className="eyebrow">Бір реттік сілтеме</p><h1>Жаңа құпиясөз орнатыңыз.</h1></div><span className="login-formula"><KeyRound size={54} /></span></div><div className="login-panel"><a className="back-link" href="/login"><ArrowLeft size={16} /> Кіру бетіне оралу</a>{token ? <ResetPasswordForm token={token} /> : <div className="form-alert">Қалпына келтіру сілтемесі жарамсыз.</div>}</div></main>;
}
