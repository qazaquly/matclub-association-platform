export type RoleSlug =
  | "member"
  | "branch_staff"
  | "branch_director"
  | "department_staff"
  | "department_head"
  | "vice_president_1"
  | "vice_president_2"
  | "president"
  | "super_admin";

export type MembershipStatus =
  | "registered_user"
  | "applicant"
  | "reserve"
  | "member"
  | "rejected"
  | "suspended"
  | "former_member";

export type ApplicationDecision = "rejected" | "reserve" | "approved";

export interface UserRoleAssignment {
  assignmentId: string;
  slug: RoleSlug;
  nameKk: string;
  accessLevel: "A" | "B" | "C" | "D";
  scopeType: "global" | "branch" | "department";
  scopeId: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  profileId: string;
  membershipStatus: MembershipStatus;
  branchId: string | null;
  roles: UserRoleAssignment[];
  sessionId: string;
}
