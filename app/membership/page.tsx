import type { Metadata } from "next";
import Image from "next/image";
import { FileLock2, QrCode, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { getMembershipApplicationDraft, listBranches } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { MembershipApplicationForm } from "./MembershipApplicationForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Бірлестікке мүше болу" };

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ source?: string; error?: string }> }) {
  const params = await searchParams;
  const source = params.source === "qr" ? "qr" : "web";
  const user = await getCurrentUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/membership?source=${source}`)}`);
  if (!user.emailVerifiedAt) redirect("/verify-email");
  const [branches, draft] = await Promise.all([listBranches(), getMembershipApplicationDraft(user)]);
  const canContinue = user.membershipStatus === "registered_user";

  return <PublicShell><main className="membership-page">
    <section className="membership-intro"><div className="container membership-intro-grid"><div><p className="eyebrow">Мүшелікке өтініш</p><h1>Кәсіби бірлестікке <em>қосылыңыз.</em></h1><p>Расталған тіркелгіңізбен өтінішті үш бөлімде толтырыңыз. Draft автоматты сақталады және кейін қайта жалғастырылады.</p><div className="process-list"><span><b>1</b> Жеке деректер</span><span><b>2</b> Кәсіби мәліметтер</span><span><b>3</b> Құжаттар және келісімдер</span></div></div><aside><QrCode size={24} /><strong>QR арқылы ашылатын сілтеме</strong><Image src="/api/membership-qr" width={156} height={156} unoptimized alt="Мүшелік нысанының QR коды" /><small>/membership?source=qr</small></aside></div></section>
    <section className="section container form-layout"><div className="form-main"><div className="form-heading"><span>Мүшелік өтініші</span><h2>Үш бөлімді өтініш</h2><p>Жұлдызшамен белгіленген өрістер міндетті. Қате өріс нақты көрсетіледі, қалған дерек жоғалмайды.</p></div>
      {params.error && <div className="form-alert" role="alert">Алдыңғы әрекет аяқталмады. Сақталған draft деректерін тексеріңіз.</div>}
      {canContinue ? <MembershipApplicationForm
        branches={branches.map((branch) => ({ regionCode: branch.regionCode, regionName: branch.regionName, status: branch.status }))}
        source={(draft?.source === "qr" ? "qr" : source)}
        initialDraft={draft ?? undefined}
        initialDocuments={draft?.documents}
      /> : <div className="form-alert success"><p>Бұл тіркелгіде мүшелік өтініші бұрын жіберілген.</p><a className="button button-primary" href="/dashboard/profile">Профильге өту</a></div>}
    </div><aside className="form-aside"><div><ShieldCheck size={24} /><h3>Деректер қорғалған</h3><p>Draft пен тіркелген құжаттар тек иесіне көрінеді. Өтініш нақты жіберілгеннен кейін ғана өңірлік қарауға өтеді.</p></div><div><FileLock2 size={24} /><h3>Бір тұрақты профиль</h3><p>Қайта толтыру немесе қате түзету екінші тіркелгі, профиль не өтініш жасамайды.</p></div></aside></section>
  </main></PublicShell>;
}
