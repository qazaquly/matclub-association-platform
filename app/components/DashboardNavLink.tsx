"use client";

import { usePathname } from "next/navigation";

export function DashboardNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const current = path === href ? "page" : href !== "/dashboard" && path?.startsWith(href + "/") ? "location" : undefined;
  return <a href={href} aria-current={current}>{children}</a>;
}
