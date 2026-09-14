import { CheckCircle2 } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "" } = await searchParams;
  return <PublicShell><main className="success-page"><div className="success-card"><CheckCircle2 size={38} /><p className="eyebrow dark">Өтініш қабылданды</p><h1>Рақмет. Өтінішіңіз өңірлік филиалға жіберілді.</h1><p>Тіркелгіңіз белсенді. Осы электрондық пошта мен құпиясөз арқылы жүйеге кіріп, ағымдағы мәртебеңізді көре аласыз.</p>{id && <div className="reference"><span>Өтініш нөмірі</span><strong>{id.slice(0, 8).toUpperCase()}</strong></div>}<a className="button button-primary" href="/login">Жүйеге кіру</a></div></main></PublicShell>;
}
