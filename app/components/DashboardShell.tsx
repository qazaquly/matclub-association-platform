import Link from "next/link";
import { Activity, BookOpenCheck, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import type { AppUser } from "@/lib/types";
import { canManageRoles, canReviewApplications, canViewAudit, isDepartmentAccess, isFullAccess } from "@/lib/authorization";
import { statusLabel } from "@/lib/format";

export function DashboardShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const nav = [
    { href: "/dashboard", label: "Шолу", icon: LayoutDashboard, show: true },
    { href: "/dashboard/applications", label: "Өтініштер", icon: ClipboardList, show: canReviewApplications(user) },
    { href: "/dashboard/members", label: "Мүшелер", icon: UsersRound, show: canReviewApplications(user) },
    { href: "/dashboard/professional", label: "Кәсіби деректер", icon: BookOpenCheck, show: isDepartmentAccess(user) && !isFullAccess(user) },
    { href: "/dashboard/branches", label: "Филиалдар", icon: Building2, show: canReviewApplications(user) },
    { href: "/dashboard/access", label: "Рөлдер мен құқықтар", icon: ShieldCheck, show: canManageRoles(user) },
    { href: "/dashboard/audit", label: "Аудит журналы", icon: Activity, show: canViewAudit(user) },
    { href: "/dashboard/profile", label: "Менің профилім", icon: UserRound, show: true },
  ];
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><Link className="dash-brand" href="/dashboard"><span>∑</span><div><strong>ҚМРҚ</strong><small>Басқару жүйесі</small></div></Link><nav>{nav.filter((item) => item.show).map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label}</Link>)}</nav><div className="sidebar-user"><div className="avatar">{user.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><strong>{user.fullName}</strong><small>{user.roles[0]?.nameKk ?? statusLabel(user.membershipStatus)}</small></div><form action="/api/auth/logout" method="post"><button title="Шығу" type="submit"><LogOut size={17} /></button></form></div></aside><div className="dashboard-main"><header className="dashboard-topbar"><details><summary><Menu size={21} /> Мәзір</summary><nav>{nav.filter((item) => item.show).map(({ href, label }) => <Link href={href} key={href}>{label}</Link>)}</nav></details><div><span className="environment-pill">Phase 1</span><Link href="/" target="_blank">Ресми сайт</Link></div></header>{children}</div></div>;
}
