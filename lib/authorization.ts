import type { AppUser, RoleSlug } from "./types";

const fullAccessRoles = new Set<RoleSlug>(["president", "vice_president_2"]);
const departmentRoles = new Set<RoleSlug>(["vice_president_1", "department_head", "department_staff"]);
const scopedDepartmentRoles = new Set<RoleSlug>(["department_head", "department_staff"]);
const branchRoles = new Set<RoleSlug>(["branch_director", "branch_staff"]);
const eventBranchRoles = new Set<RoleSlug>(["branch_director", "branch_event_manager"]);
const projectBranchRoles = new Set<RoleSlug>(["branch_director", "branch_project_manager"]);
const projectDepartmentRoles = new Set<RoleSlug>(["department_head"]);
const institutionalDocumentDepartmentRoles = new Set<RoleSlug>(["vice_president_1", "department_head", "department_staff"]);

export function hasRole(user: AppUser, roles: Iterable<RoleSlug>) {
  const allowed = new Set(roles);
  return user.roles.some((role) => allowed.has(role.slug));
}

export function isFullAccess(user: AppUser) {
  return hasRole(user, fullAccessRoles);
}

export function isDepartmentAccess(user: AppUser) {
  return hasRole(user, departmentRoles);
}

export function isNationwideProfessionalAccess(user: AppUser) {
  return hasRole(user, ["vice_president_1"]);
}

export function isBranchAccess(user: AppUser) {
  return hasRole(user, branchRoles);
}

export function branchScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => branchRoles.has(role.slug) && role.scopeType === "branch" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function eventBranchScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => eventBranchRoles.has(role.slug) && role.scopeType === "branch" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function projectBranchScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => projectBranchRoles.has(role.slug) && role.scopeType === "branch" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function projectDepartmentScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => projectDepartmentRoles.has(role.slug) && role.scopeType === "department" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function departmentScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => scopedDepartmentRoles.has(role.slug) && role.scopeType === "department" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function institutionalDocumentDepartmentScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => institutionalDocumentDepartmentRoles.has(role.slug) && role.scopeType === "department" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function canAccessBranch(user: AppUser, branchId: string) {
  return isFullAccess(user) || branchScopeIds(user).includes(branchId);
}

export function canViewAudit(user: AppUser) {
  return isFullAccess(user);
}

export function canManageRoles(user: AppUser) {
  return hasRole(user, ["president", "vice_president_2"]);
}

export function canReviewApplications(user: AppUser) {
  return isFullAccess(user) || isBranchAccess(user);
}

export function canReopenApplication(user: AppUser) {
  return isFullAccess(user);
}

export function hasPermission(user: AppUser, permission: string) {
  return user.permissions.includes(permission);
}

export function canManagePublicContent(user: AppUser) {
  return hasPermission(user, "public_content.manage");
}

export function canManageDynamicContent(user: AppUser) {
  return hasPermission(user, "dynamic_content.manage");
}

export function canPublishDynamicContent(user: AppUser) {
  return hasPermission(user, "dynamic_content.publish");
}

export function canManagePublicMedia(user: AppUser) {
  return hasPermission(user, "public_media.manage");
}

export function canManageGlobalEvents(user: AppUser) {
  return hasPermission(user, "events.manage_global");
}

export function canManageBranchEvents(user: AppUser) {
  return hasPermission(user, "events.manage_branch");
}

export function canPublishEvents(user: AppUser) {
  return hasPermission(user, "events.publish");
}

export function canManageEventResults(user: AppUser) {
  return hasPermission(user, "events.results.manage");
}

export function canGenerateEventNews(user: AppUser) {
  return hasPermission(user, "events.news.generate");
}

export function canViewEventParticipants(user: AppUser) {
  return hasPermission(user, "events.participants.read");
}

export function canManageEventParticipants(user: AppUser) {
  return hasPermission(user, "events.participants.manage");
}

export function canManageEventAttendance(user: AppUser) {
  return hasPermission(user, "events.attendance.manage");
}

export function canManageEventSeating(user: AppUser) {
  return hasPermission(user, "events.seating.manage");
}

export function canAccessManagedEvent(user: AppUser, event: { branchId: string | null }) {
  return canManageGlobalEvents(user) || Boolean(event.branchId && eventBranchScopeIds(user).includes(event.branchId));
}

export function canReadProjects(user: AppUser) {
  return user.membershipStatus === "member" || hasPermission(user, "projects.read") || hasPermission(user, "projects.manage_global");
}

export function canManageGlobalProjects(user: AppUser) {
  return hasPermission(user, "projects.manage_global");
}

export function canManageBranchProjects(user: AppUser) {
  return hasPermission(user, "projects.manage_branch");
}

export function canManageDepartmentProjects(user: AppUser) {
  return hasPermission(user, "projects.manage_department");
}

export function canAccessManagedProject(user: AppUser, project: { projectScope?: string; branchId: string | null; responsibleDepartmentId: string | null; leaderProfileId: string | null }) {
  if (canManageGlobalProjects(user) || project.leaderProfileId === user.profileId) return true;
  if (project.projectScope === "ALL_BRANCHES" && canManageBranchProjects(user) && projectBranchScopeIds(user).length > 0) return true;
  if (canManageBranchProjects(user) && project.branchId && projectBranchScopeIds(user).includes(project.branchId)) return true;
  return Boolean(canManageDepartmentProjects(user) && project.responsibleDepartmentId && projectDepartmentScopeIds(user).includes(project.responsibleDepartmentId));
}

export function canManageProjectParticipants(user: AppUser, project?: { leaderProfileId: string | null }) {
  return hasPermission(user, "projects.participants.manage") || project?.leaderProfileId === user.profileId;
}

export function canManageProjectStages(user: AppUser, project?: { leaderProfileId: string | null }) {
  return hasPermission(user, "projects.stages.manage") || project?.leaderProfileId === user.profileId;
}

export function canManageProjectDocuments(user: AppUser, project?: { leaderProfileId: string | null }) {
  return hasPermission(user, "projects.documents.manage") || project?.leaderProfileId === user.profileId;
}

export function canManageProjectResults(user: AppUser, project?: { leaderProfileId: string | null }) {
  return hasPermission(user, "projects.results.manage") || project?.leaderProfileId === user.profileId;
}

export function canManageProfessionalCategoryCatalog(user: AppUser) {
  return hasPermission(user, "professional_categories.catalog.manage");
}

export function canViewReports(user: AppUser) {
  return hasPermission(user, "reports.read");
}

export function canExportReports(user: AppUser) {
  return hasPermission(user, "reports.export");
}

export function canReadInstitutionalDocuments(user: AppUser) {
  return hasPermission(user, "institutional_documents.read") && user.membershipStatus === "member";
}

export function canManageGlobalInstitutionalDocuments(user: AppUser) {
  return hasPermission(user, "institutional_documents.manage_global");
}

export function canManageBranchInstitutionalDocuments(user: AppUser) {
  return hasPermission(user, "institutional_documents.manage_branch");
}

export function canManageDepartmentInstitutionalDocuments(user: AppUser) {
  return hasPermission(user, "institutional_documents.manage_department");
}

export function canManageInstitutionalDocument(
  user: AppUser,
  document: { scopeType: string; branchId: string | null; responsibleDepartmentId: string | null; accessLevel?: string },
) {
  if (canManageGlobalInstitutionalDocuments(user)) return true;
  if (document.accessLevel === "LEADERSHIP") return false;
  if (document.scopeType === "BRANCH" && document.branchId && canManageBranchInstitutionalDocuments(user)) {
    return branchScopeIds(user).includes(document.branchId);
  }
  return Boolean(
    document.scopeType === "NATIONAL" &&
    document.responsibleDepartmentId &&
    canManageDepartmentInstitutionalDocuments(user) &&
    institutionalDocumentDepartmentScopeIds(user).includes(document.responsibleDepartmentId),
  );
}

export function canAccessInstitutionalDocument(
  user: AppUser,
  document: {
    status: string;
    scopeType: string;
    branchId: string | null;
    responsibleDepartmentId: string | null;
    accessLevel: string;
  },
) {
  if (canManageGlobalInstitutionalDocuments(user)) return true;
  if (document.accessLevel === "LEADERSHIP") return false;
  if (canManageInstitutionalDocument(user, document)) return true;
  if (!canReadInstitutionalDocuments(user)) return false;
  if (document.accessLevel === "MEMBERS") {
    return document.status === "ACTIVE" && (document.scopeType === "NATIONAL" || document.branchId === user.branchId);
  }
  if (document.accessLevel !== "RESPONSIBLE") return false;
  if (document.scopeType === "BRANCH" && document.branchId) return branchScopeIds(user).includes(document.branchId);
  return Boolean(document.responsibleDepartmentId && institutionalDocumentDepartmentScopeIds(user).includes(document.responsibleDepartmentId));
}

export function canAssignProfessionalCategories(user: AppUser) {
  return hasPermission(user, "professional_categories.assign");
}

export function canAssignProfessionalCategoriesForPerson(
  user: AppUser,
  person: { branchId: string | null; departmentIds: string[] },
) {
  if (!canAssignProfessionalCategories(user)) return false;
  if (isFullAccess(user) || isNationwideProfessionalAccess(user)) return true;
  if (person.branchId && branchScopeIds(user).includes(person.branchId)) return true;
  const allowedDepartments = new Set(departmentScopeIds(user));
  return person.departmentIds.some((departmentId) => allowedDepartments.has(departmentId));
}
