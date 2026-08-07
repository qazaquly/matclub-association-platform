import { redirect } from "next/navigation";
import { DashboardShell } from "@/app/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
