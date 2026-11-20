export function CatalogViews({ base, state, creating, label, canCreate = true }: {
  base: string;
  state: { q?: string; status?: string; scope?: string; branchId?: string };
  creating: boolean;
  label: string;
  canCreate?: boolean;
}) {
  const filters = new URLSearchParams();
  for (const key of ["q", "status", "scope", "branchId"] as const) {
    const value = state[key];
    if (value) filters.set(key, value);
  }
  const listHref = filters.size ? base + "?" + filters : base;
  filters.set("create", "1");
  return <nav className="task-links" aria-label="Бөлім әрекеттері">
    <a href={listHref} aria-current={creating ? undefined : "page"}>Тізім</a>
    {canCreate && <a href={base + "?" + filters} aria-current={creating ? "page" : undefined}>{label}</a>}
  </nav>;
}
