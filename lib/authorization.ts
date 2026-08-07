import type { AppUser, RoleSlug } from "./types";

const fullAccessRoles = new Set<RoleSlug>(["president", "vice_president_1", "super_admin"]);
const departmentRoles = new Set<RoleSlug>(["vice_president_2", "department_head", "department_staff"]);
const branchRoles = new Set<RoleSlug>(["branch_director", "branch_staff"]);

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

export function isBranchAccess(user: AppUser) {
  return hasRole(user, branchRoles);
}

export function branchScopeIds(user: AppUser) {
  return user.roles
    .filter((role) => branchRoles.has(role.slug) && role.scopeType === "branch" && role.scopeId)
    .map((role) => role.scopeId as string);
}

export function canAccessBranch(user: AppUser, branchId: string) {
  return isFullAccess(user) || branchScopeIds(user).includes(branchId);
}

export function canViewAudit(user: AppUser) {
  return isFullAccess(user);
}

export function canManageRoles(user: AppUser) {
  return isFullAccess(user);
}

export function canReviewApplications(user: AppUser) {
  return isFullAccess(user) || isBranchAccess(user);
}
