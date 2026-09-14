import { Activity, BarChart3, BookOpenCheck, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, ClipboardList, FilePenLine, FileStack, FileX2, LayoutDashboard, LogOut, Menu, ShieldCheck, Tags, UserRound, UsersRound } from "lucide-react";
import type { AppUser } from "@/lib/types";
import { canManageBranchEvents, canManageDynamicContent, canManageGlobalEvents, canManageProfessionalCategoryCatalog, canManagePublicContent, canManageRoles, canReadInstitutionalDocuments, canReadProjects, canReviewApplications, canViewAudit, canViewReports, isDepartmentAccess, isFullAccess } from "@/lib/authorization";
import { statusLabel } from "@/lib/format";

export function DashboardShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const nav = [
    { href: "/dashboard", label: "Шолу", icon: LayoutDashboard, show: true },
    { href: "/dashboard/applications", label: "Өтініштер", icon: ClipboardList, show: canReviewApplications(user) },
    { href: "/dashboard/members", label: "Мүшелер", icon: UsersRound, show: canReviewApplications(user) },
    { href: "/dashboard/professional", label: "Кәсіби деректер", icon: BookOpenCheck, show: isDepartmentAccess(user) && !isFullAccess(user) },
    { href: "/dashboard/branches", label: "Филиалдар", icon: Building2, show: canReviewApplications(user) },
    { href: "/dashboard/events", label: "Іс-шаралар", icon: CalendarDays, show: canManageGlobalEvents(user) || canManageBranchEvents(user) },
    { href: "/dashboard/projects", label: "Жобалар", icon: BriefcaseBusiness, show: canReadProjects(user) },
    { href: "/dashboard/reports", label: "Есептер", icon: BarChart3, show: canViewReports(user) },
    { href: "/dashboard/analytics", label: "Басқару көрсеткіштері", icon: ChartNoAxesCombined, show: canViewReports(user) },
    { href: "/dashboard/documents", label: "Ішкі құжаттар қоры", icon: FileStack, show: canReadInstitutionalDocuments(user) },
    { href: "/dashboard/document-requests", label: "Құжат жою сұраулары", icon: FileX2, show: isFullAccess(user) },
    { href: "/dashboard/categories", label: "Кәсіби санаттар", icon: Tags, show: canManageProfessionalCategoryCatalog(user) },
    { href: "/dashboard/access", label: "Рөлдер мен құқықтар", icon: ShieldCheck, show: canManageRoles(user) },
    { href: "/dashboard/content", label: "Сайт мазмұны", icon: FilePenLine, show: canManagePublicContent(user) || canManageDynamicContent(user) },
    { href: "/dashboard/audit", label: "Аудит журналы", icon: Activity, show: canViewAudit(user) },
    { href: "/dashboard/profile", label: "Менің профилім", icon: UserRound, show: true },
  ];
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><a className="dash-brand" href="/dashboard"><span>∑</span><div><strong>Бірлестік</strong><small>Басқару жүйесі</small></div></a><nav>{nav.filter((item) => item.show).map(({ href, label, icon: Icon }) => <a href={href} key={href}><Icon size={18} />{label}</a>)}</nav><div className="sidebar-user"><div className="avatar">{user.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div><div><strong>{user.fullName}</strong><small>{user.roles[0]?.nameKk ?? statusLabel(user.membershipStatus)}</small></div><form action="/api/auth/logout" method="post"><button title="Шығу" type="submit"><LogOut size={17} /></button></form></div></aside><div className="dashboard-main"><header className="dashboard-topbar"><details><summary><Menu size={21} /> Мәзір</summary><nav>{nav.filter((item) => item.show).map(({ href, label }) => <a href={href} key={href}>{label}</a>)}</nav></details><div><span className="environment-pill">Phase 2 · Толық платформа</span><a href="/" target="_blank">Ресми сайт</a></div></header>{children}</div></div>;
}
