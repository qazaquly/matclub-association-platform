import { notFound } from "next/navigation";
import { BranchDirectory, type DirectorySearch } from "@/app/components/BranchDirectory";
import { listBranches } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canReviewApplications } from "@/lib/authorization";

export default async function DashboardBranchesPage({ searchParams }: { searchParams: Promise<DirectorySearch & { success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const [branches, state] = await Promise.all([listBranches(user), searchParams]);
  return <main className="dashboard-content">
    <div className="dash-page-heading"><h1>Филиалдар</h1></div>
    {state.success && <div className="dash-alert success">Филиал деректері жаңартылды.</div>}
    {state.error && <div className="dash-alert error">Филиал деректерін сақтау мүмкін болмады.</div>}
    <BranchDirectory branches={branches} query={state} cabinet />
  </main>;
}
