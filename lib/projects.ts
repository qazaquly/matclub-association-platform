export const projectScopes = ["NATIONAL", "BRANCH", "ALL_BRANCHES"] as const;
export const projectStatuses = ["DRAFT", "PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"] as const;
export const projectStageStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const projectParticipantRoles = ["LEADER", "COORDINATOR", "PARTICIPANT", "EXPERT", "VOLUNTEER"] as const;
export const projectParticipantStatuses = ["ACTIVE", "COMPLETED", "WITHDRAWN"] as const;
export const projectDocumentCategories = ["PLAN", "AGREEMENT", "REPORT", "RESULT", "OTHER"] as const;

function value(form: FormData, key: string, maxLength: number, required = false) {
  const result = String(form.get(key) ?? "").trim();
  if ((required && !result) || result.length > maxLength) throw new Error(`INVALID_PROJECT:${key}`);
  return result || null;
}

function dateValue(form: FormData, key: string, required = false) {
  const raw = value(form, key, 20, required);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`INVALID_PROJECT:${key}`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_PROJECT:${key}`);
  return date;
}

export function parseProjectForm(form: FormData) {
  const submittedScope = value(form, "projectScope", 20, true)!;
  const submittedBranchId = submittedScope === "BRANCH" ? value(form, "branchId", 120, true) : null;
  const projectScope = submittedScope === "BRANCH" && submittedBranchId === "__all__" ? "ALL_BRANCHES" : submittedScope;
  if (!(projectScopes as readonly string[]).includes(projectScope)) throw new Error("INVALID_PROJECT:projectScope");
  const branchId = projectScope === "BRANCH" ? submittedBranchId : null;
  if (projectScope === "BRANCH" && !branchId) throw new Error("INVALID_PROJECT:branchId");
  const startDate = dateValue(form, "startDate", true)!;
  const endDate = dateValue(form, "endDate");
  if (endDate && endDate < startDate) throw new Error("INVALID_PROJECT:dates");
  const codeRaw = value(form, "code", 80);
  return {
    title: value(form, "title", 240, true)!,
    code: codeRaw ? codeRaw.toLocaleUpperCase("kk-KZ") : null,
    summary: value(form, "summary", 2_000, true)!,
    description: value(form, "description", 20_000),
    projectScope,
    branchId,
    responsibleDepartmentId: value(form, "responsibleDepartmentId", 120),
    leaderProfileId: value(form, "leaderProfileId", 120),
    publicProjectId: value(form, "publicProjectId", 120),
    startDate,
    endDate,
  };
}

export function parseProjectStageForm(form: FormData) {
  const startDate = dateValue(form, "startDate");
  const endDate = dateValue(form, "endDate");
  if (startDate && endDate && endDate < startDate) throw new Error("INVALID_PROJECT_STAGE:dates");
  return {
    title: value(form, "title", 240, true)!,
    description: value(form, "description", 2_000),
    startDate,
    endDate,
  };
}

export function parseProjectResultForm(form: FormData) {
  const beneficiaryRaw = value(form, "beneficiaryCount", 12);
  const beneficiaryCount = beneficiaryRaw == null ? null : Number(beneficiaryRaw);
  if (beneficiaryCount != null && (!Number.isSafeInteger(beneficiaryCount) || beneficiaryCount < 0 || beneficiaryCount > 100_000_000)) {
    throw new Error("INVALID_PROJECT_RESULT:beneficiaryCount");
  }
  return {
    summary: value(form, "summary", 10_000, true)!,
    outcomes: value(form, "outcomes", 20_000),
    deliverables: value(form, "deliverables", 20_000),
    beneficiaryCount,
    completedAt: dateValue(form, "completedAt"),
  };
}

export function projectScopeLabel(scope: string) {
  return ({ NATIONAL: "Республикалық", BRANCH: "Филиалдық", ALL_BRANCHES: "Барлық филиалға" } as Record<string, string>)[scope] ?? scope;
}

export function projectCoverageLabel(project: { projectScope: string; branch?: { regionName: string } | null; responsibleDepartment?: { nameKk: string } | null }) {
  if (project.projectScope === "ALL_BRANCHES") return "Барлық филиал";
  return project.branch?.regionName ?? project.responsibleDepartment?.nameKk ?? "Орталық";
}

export function projectStatusLabel(status: string) {
  return ({ DRAFT: "Жоба", PLANNED: "Жоспарланған", ACTIVE: "Жүріп жатыр", PAUSED: "Уақытша тоқтаған", COMPLETED: "Аяқталған", CANCELLED: "Болдырылмаған", ARCHIVED: "Архив" } as Record<string, string>)[status] ?? status;
}

export function projectStageStatusLabel(status: string) {
  return ({ PENDING: "Күтілуде", IN_PROGRESS: "Орындалып жатыр", COMPLETED: "Аяқталды", CANCELLED: "Болдырылмады" } as Record<string, string>)[status] ?? status;
}

export function projectParticipantRoleLabel(role: string) {
  return ({ LEADER: "Жетекші", COORDINATOR: "Үйлестіруші", PARTICIPANT: "Қатысушы", EXPERT: "Сарапшы", VOLUNTEER: "Ерікті" } as Record<string, string>)[role] ?? role;
}

export function projectParticipantStatusLabel(status: string) {
  return ({ ACTIVE: "Қатысып жүр", COMPLETED: "Қатысты", WITHDRAWN: "Шыққан" } as Record<string, string>)[status] ?? status;
}

export function projectDocumentCategoryLabel(category: string) {
  return ({ PLAN: "Жоспар", AGREEMENT: "Келісім", REPORT: "Есеп", RESULT: "Нәтиже", OTHER: "Басқа" } as Record<string, string>)[category] ?? category;
}

export function allowedProjectTransitions(status: string) {
  return ({
    DRAFT: ["PLANNED", "CANCELLED", "ARCHIVED"],
    PLANNED: ["ACTIVE", "PAUSED", "CANCELLED", "ARCHIVED"],
    ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
    PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED"],
    COMPLETED: ["ARCHIVED"],
    CANCELLED: ["ARCHIVED"],
    ARCHIVED: [],
  } as Record<string, string[]>)[status] ?? [];
}
