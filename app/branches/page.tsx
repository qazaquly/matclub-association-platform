import type { Metadata } from "next";
import { BranchDirectory, type DirectorySearch } from "@/app/components/BranchDirectory";
import { PublicShell } from "@/app/components/PublicShell";
import { getPublicContentValues, listBranches } from "@/db/queries";


export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Өңірлік филиалдар" };

export default async function BranchesPage({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  const [branches, content] = await Promise.all([listBranches(), getPublicContentValues()]);
  return <PublicShell content={content}><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">Өңірлік желі</p><h1>Өңірлік филиалдар</h1><p>{content["page.branches.lead"]}</p></div></section><section className="section container"><BranchDirectory branches={branches} query={await searchParams} /></section></main></PublicShell>;
}
