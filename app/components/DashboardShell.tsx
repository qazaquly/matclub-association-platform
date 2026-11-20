/* eslint-disable @next/next/no-html-link-for-pages -- use browser-native navigation in the dashboard. */
import { Activity, BarChart3, BookOpenCheck, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined, ClipboardList, FilePenLine, FileStack, FileX2, LayoutDashboard, LogOut, Menu, ShieldCheck, Tags, UserRound, UsersRound } from "lucide-react";
import { DashboardNavLink } from "./DashboardNavLink";
import type { AppUser } from "@/lib/types";
import { canManageBranchEvents, canManageDynamicContent, canManageGlobalEvents, canManageProfessionalCategoryCatalog, canManagePublicContent, canManageRoles, canReadInstitutionalDocuments, canReadProjects, canReviewApplications, canViewAudit, canViewReports, isDepartmentAccess, isFullAccess } from "@/lib/authorization";
import { statusLabel } from "@/lib/format";

export function DashboardShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const nav = [
    { group: "Кабинет", href: "/dashboard", label: "Шолу", icon: LayoutDashboard, show: true },
    { group: "Мүшелік", href: "/dashboard/applications", label: "Өтініштер", icon: ClipboardList, show: canReviewApplications(user) },
    { group: "Мүшелік", href: "/dashboard/members", label: "Мүшелер", icon: UsersRound, show: canReviewApplications(user) },
    { group: "Мүшелік", href: "/dashboard/professional", label: "Кәсіби деректер", icon: BookOpenCheck, show: isDepartmentAccess(user) && !isFullAccess(user) },
    { group: "Мүшелік", href: "/dashboard/branches", label: "Филиалдар", icon: Building2, show: canReviewApplications(user) },
    { group: "Іс-шаралар мен жобалар", href: "/dashboard/events", label: "Іс-шаралар", icon: CalendarDays, show: canManageGlobalEvents(user) || canManageBranchEvents(user) },
    { group: "Іс-шаралар мен жобалар", href: "/dashboard/projects", label: "Жобалар", icon: BriefcaseBusiness, show: canReadProjects(user) },
    { group: "Есеп және басқару", href: "/dashboard/reports", label: "Есептер", icon: BarChart3, show: canViewReports(user) },
    { group: "Есеп және басқару", href: "/dashboard/analytics", label: "Басқару көрсеткіштері", icon: ChartNoAxesCombined, show: canViewReports(user) },
    { group: "Есеп және басқару", href: "/dashboard/documents", label: "Ішкі құжаттар қоры", icon: FileStack, show: canReadInstitutionalDocuments(user) },
    { group: "Есеп және басқару", href: "/dashboard/document-requests", label: "Құжат жою сұраулары", icon: FileX2, show: isFullAccess(user) },
    { group: "Есеп және басқару", href: "/dashboard/categories", label: "Кәсіби санаттар", icon: Tags, show: canManageProfessionalCategoryCatalog(user) },
    { group: "Есеп және басқару", href: "/dashboard/access", label: "Рөлдер мен құқықтар", icon: ShieldCheck, show: canManageRoles(user) },
    { group: "Есеп және басқару", href: "/dashboard/content", label: "Сайт мазмұны", icon: FilePenLine, show: canManagePublicContent(user) || canManageDynamicContent(user) },
    { group: "Есеп және басқару", href: "/dashboard/audit", label: "Аудит журналы", icon: Activity, show: canViewAudit(user) },
    { group: "Кабинет", href: "/dashboard/profile", label: "Менің профилім", icon: UserRound, show: true },
  ];
  const visible = nav.filter((item) => item.show);
  const sections = [...new Set(visible.map((item) => item.group))];
  function navigation(mobile = false) {
    return <nav aria-label="Жеке кабинет">
      {sections.map((group) => <div className="dash-nav-group" key={group}>
        {sections.length > 1 && <strong>{group}</strong>}
        {visible.filter((item) => item.group === group).map(({ href, label, icon: Icon }) =>
          <DashboardNavLink href={href} key={href}>{!mobile && <Icon size={18} />}{label}</DashboardNavLink>)}
      </div>)}
      {mobile && <form action="/api/auth/logout" method="post">
        <button className="mobile-logout" type="submit"><LogOut size={16} /> Аккаунттан шығу</button>
      </form>}
    </nav>;
  }
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <a className="dash-brand" href="/dashboard"><span>∑</span><div><strong>Бірлестік</strong><small>Басқару жүйесі</small></div></a>
      {navigation()}
      <div className="sidebar-user">
        <div className="avatar">{user.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</div>
        <div><strong>{user.fullName}</strong><small>{user.roles[0]?.nameKk ?? statusLabel(user.membershipStatus)}</small></div>
        <form action="/api/auth/logout" method="post"><button title="Шығу" aria-label="Аккаунттан шығу" type="submit"><LogOut size={17} /></button></form>
      </div>
    </aside>
    <div className="dashboard-main">
      <header className="dashboard-topbar">
        <details><summary><Menu size={21} /> Мәзір</summary>{navigation(true)}</details>
        <a href="/">Ресми сайт</a>
      </header>
      {children}
    </div>
  </div>;
}
