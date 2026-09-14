"use client";

import { useState } from "react";

type Options = {
  branches: Array<{ id: string; regionName: string }>;
  departments: Array<{ id: string; nameKk: string }>;
  people: Array<{ id: string; fullName: string; branchId: string | null }>;
  publicProjects: Array<{ id: string; title: string; status: string }>;
};

type ProjectItem = {
  title: string;
  code: string | null;
  summary: string;
  description: string | null;
  projectScope: string;
  branchId: string | null;
  responsibleDepartmentId: string | null;
  leaderProfileId: string | null;
  publicProjectId: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
};

function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function ProjectForm({ action, options, canChooseNational, canChooseAllBranches = false, item, submitLabel }: {
  action: string;
  options: Options;
  canChooseNational: boolean;
  canChooseAllBranches?: boolean;
  item?: ProjectItem;
  submitLabel: string;
}) {
  const [scope, setScope] = useState(item?.projectScope === "ALL_BRANCHES" ? "BRANCH" : (item?.projectScope ?? (canChooseNational ? "NATIONAL" : "BRANCH")));
  const branchSelection = item?.projectScope === "ALL_BRANCHES" ? "__all__" : (item?.branchId ?? "");
  return <form action={action} className="project-form" method="post">
    {item && <input name="action" type="hidden" value="update" />}
    <label className="content-field-wide"><span>Жоба атауы *</span><input defaultValue={item?.title ?? ""} maxLength={240} name="title" required /></label>
    <label><span>Ішкі коды</span><input defaultValue={item?.code ?? ""} maxLength={80} name="code" placeholder="Мысалы: RMB-2026-01" /></label>
    <label><span>Деңгейі *</span><select name="projectScope" onChange={(event) => setScope(event.target.value)} value={scope}>{canChooseNational && <option value="NATIONAL">Республикалық</option>}<option value="BRANCH">Филиалдық</option></select></label>
    {scope === "BRANCH" && <label><span>Филиал *</span><select defaultValue={branchSelection} name="branchId" required><option disabled value="">Филиалды таңдаңыз</option>{(canChooseAllBranches || item?.projectScope === "ALL_BRANCHES") && <option value="__all__">Барлық филиал</option>}{options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.regionName}</option>)}</select></label>}
    <label><span>Жауапты департамент</span><select defaultValue={item?.responsibleDepartmentId ?? ""} name="responsibleDepartmentId"><option value="">Тағайындалмаған</option>{options.departments.map((department) => <option key={department.id} value={department.id}>{department.nameKk}</option>)}</select></label>
    <label><span>Жоба жетекшісі</span><select defaultValue={item?.leaderProfileId ?? ""} name="leaderProfileId"><option value="">Тағайындалмаған</option>{options.people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
    {options.publicProjects.length > 0 && <label><span>Ашық сайттағы жоба</span><select defaultValue={item?.publicProjectId ?? ""} name="publicProjectId"><option value="">Байланыстырылмаған</option>{options.publicProjects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.status}</option>)}</select></label>}
    <label><span>Басталу күні *</span><input defaultValue={dateInput(item?.startDate)} name="startDate" required type="date" /></label>
    <label><span>Аяқталу күні</span><input defaultValue={dateInput(item?.endDate)} name="endDate" type="date" /></label>
    <label className="content-field-wide"><span>Қысқаша мақсаты *</span><textarea defaultValue={item?.summary ?? ""} maxLength={2000} name="summary" required rows={3} /></label>
    <label className="content-field-wide"><span>Толық сипаттамасы</span><textarea defaultValue={item?.description ?? ""} maxLength={20000} name="description" rows={6} /></label>
    <div className="project-form-submit content-field-wide"><button className="button button-primary" type="submit">{submitLabel}</button></div>
  </form>;
}
