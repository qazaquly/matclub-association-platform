import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "" } = await searchParams;
  return <PublicShell><main className="success-page"><div className="success-card"><CheckCircle2 size={38} /><p className="eyebrow dark">Өтініш қабылданды</p><h1>Рақмет. Өтінішіңіз өңірлік филиалға жіберілді.</h1><p>Жауапты қызметкерлер берілген мәліметтер мен құжаттарды қарайды. Қажет болса, сізбен көрсетілген байланыс деректері арқылы хабарласады.</p>{id && <div className="reference"><span>Өтініш нөмірі</span><strong>{id.slice(0, 8).toUpperCase()}</strong></div>}<Link className="button button-primary" href="/">Басты бетке оралу</Link></div></main></PublicShell>;
}
