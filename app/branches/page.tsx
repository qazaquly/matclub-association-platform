import type { Metadata } from "next";
import { Building2, MapPin } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";
import { getPublicContentValues, listBranches } from "@/db/queries";
import { statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Өңірлік филиалдар" };

export default async function BranchesPage() {
  const [branches, content] = await Promise.all([listBranches(), getPublicContentValues()]);
  return <PublicShell content={content}><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">Өңірлік желі</p><h1>Республикалық мақсат, жергілікті әрекет</h1><p>{content["page.branches.lead"]}</p></div></section><section className="section container"><div className="branch-public-grid">{branches.map((branch) => <article key={branch.id}><div className="branch-icon"><Building2 size={22} /></div><span className={`status-dot ${branch.status}`}><i />{statusLabel(branch.status)}</span><h2>{branch.name}</h2><p><MapPin size={15} /> {branch.regionName}</p><dl><div><dt>Мүше</dt><dd>{branch.memberCount}</dd></div><div><dt>Қаралуда</dt><dd>{branch.applicantCount}</dd></div><div><dt>Резерв</dt><dd>{branch.reserveCount}</dd></div></dl></article>)}</div></section></main></PublicShell>;
}
