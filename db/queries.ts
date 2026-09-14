import { ensureDatabase } from "./bootstrap";
import { getDb } from "./index";
import { Prisma } from "@/generated/prisma/client";
import { branchScopeIds, departmentScopeIds, isFullAccess, isNationwideProfessionalAccess } from "@/lib/authorization";
import type { AppUser } from "@/lib/types";
import { defaultPublicContent, type PublicContentValues } from "@/lib/public-content";

export interface DashboardMetrics {
  registeredUsers: number;
  applicants: number;
  awaitingReview: number;
  reserve: number;
  members: number;
  rejected: number;
}

export interface ApplicationListRow {
  id: string;
  fullName: string;
  email: string;
  cityDistrict: string;
  workplace: string | null;
  position: string | null;
  status: string;
  submittedAt: string;
  branchId: string;
  branchName: string;
}

export interface ApplicationCandidateListRow {
  personId: string;
  applicationId: string | null;
  fullName: string;
  email: string;
  cityDistrict: string;
  workplace: string | null;
  position: string | null;
  membershipStatus: "registered_user" | "applicant";
  activityAt: string;
  branchId: string | null;
  branchName: string | null;
}

export async function getMembershipApplicationDraft(user: AppUser) {
  await ensureDatabase();
  const draft = await getDb().membershipApplicationDraft.findFirst({
    where: { userId: user.id, personId: user.profileId },
    include: {
      documents: {
        where: { status: "active", archivedAt: null },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!draft) return null;
  return {
    id: draft.id,
    surname: draft.surname ?? "",
    givenName: draft.givenName ?? "",
    patronymic: draft.patronymic ?? "",
    birthDate: draft.birthDate?.toISOString().slice(0, 10) ?? "",
    regionCode: draft.regionCode ?? "",
    cityDistrict: draft.cityDistrict ?? "",
    phone: draft.phone ?? "",
    workplace: draft.workplace ?? "",
    position: draft.position ?? "",
    educationLevelCode: draft.educationLevelCode ?? "",
    educationInstitution: draft.educationInstitution ?? "",
    educationProgram: draft.educationProgram ?? "",
    mathSpecialization: draft.mathSpecialization ?? "",
    achievements: draft.achievements ?? "",
    joiningPurpose: draft.joiningPurpose ?? "",
    source: draft.source,
    termsAccepted: draft.termsAccepted,
    privacyAccepted: draft.privacyAccepted,
    status: draft.status,
    submittedApplicationId: draft.submittedApplicationId,
    updatedAt: draft.updatedAt.toISOString(),
    documents: draft.documents,
  };
}

function scopedBranchIds(user: AppUser) {
  return isFullAccess(user) ? null : branchScopeIds(user);
}

function filteredBranchIds(user: AppUser, requestedBranchId?: string) {
  const scoped = scopedBranchIds(user);
  if (!requestedBranchId) return scoped;
  return scoped ? scoped.filter((branchId) => branchId === requestedBranchId) : [requestedBranchId];
}

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

export async function getDashboardMetrics(user: AppUser): Promise<DashboardMetrics> {
  await ensureDatabase();
  const database = getDb();
  const branches = scopedBranchIds(user);
  const profileWhere = { archivedAt: null, membershipStatus: { not: "rejected" }, ...(branches ? { branchId: { in: branches } } : {}) };
  const applicationWhere = { archivedAt: null, ...(branches ? { branchId: { in: branches } } : {}) };
  const [registeredUsers, applicants, awaitingReview, reserve, members, rejected] = await Promise.all([
    database.personProfile.count({ where: { ...profileWhere, membershipStatus: "registered_user" } }),
    database.personProfile.count({ where: { ...profileWhere, membershipStatus: "applicant" } }),
    database.membershipApplication.count({ where: { ...applicationWhere, status: "awaiting_review" } }),
    database.personProfile.count({ where: { ...profileWhere, membershipStatus: "reserve" } }),
    database.personProfile.count({ where: { ...profileWhere, membershipStatus: "member" } }),
    database.membershipApplication.count({ where: { ...applicationWhere, status: "rejected" } }),
  ]);
  return { registeredUsers, applicants, awaitingReview, reserve, members, rejected };
}

export async function listApplicationCandidates(
  user: AppUser,
  limit = 50,
  filters: { membershipStatus?: "registered_user" | "applicant"; branchId?: string } = {},
): Promise<ApplicationCandidateListRow[]> {
  await ensureDatabase();
  const branches = filteredBranchIds(user, filters.branchId);
  const profiles = await getDb().personProfile.findMany({
    where: {
      archivedAt: null,
      membershipStatus: filters.membershipStatus ?? { in: ["registered_user", "applicant"] },
      ...(branches ? { branchId: { in: branches } } : {}),
    },
    include: {
      user: { select: { createdAt: true } },
      branch: { select: { id: true, name: true } },
      applications: {
        where: { archivedAt: null },
        select: { id: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ membershipStatus: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return profiles.map((profile) => ({
    personId: profile.id,
    applicationId: profile.applications[0]?.id ?? null,
    fullName: profile.fullName,
    email: profile.email,
    cityDistrict: profile.cityDistrict,
    workplace: profile.workplace,
    position: profile.position,
    membershipStatus: profile.membershipStatus as "registered_user" | "applicant",
    activityAt: (profile.applications[0]?.submittedAt ?? profile.user?.createdAt ?? profile.createdAt).toISOString(),
    branchId: profile.branchId,
    branchName: profile.branch?.name ?? null,
  }));
}

export async function listApplications(
  user: AppUser,
  limit = 50,
  filters: { status?: string; branchId?: string } = {},
): Promise<ApplicationListRow[]> {
  await ensureDatabase();
  const branches = filteredBranchIds(user, filters.branchId);
  const applications = await getDb().membershipApplication.findMany({
    where: {
      archivedAt: null,
      person: { archivedAt: null },
      ...(branches ? { branchId: { in: branches } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: { person: true, branch: true },
    orderBy: { submittedAt: "desc" },
  });
  const priority: Record<string, number> = { awaiting_review: 0, reserve: 1 };
  return applications
    .sort((left, right) => (priority[left.status] ?? 2) - (priority[right.status] ?? 2) || right.submittedAt.getTime() - left.submittedAt.getTime())
    .slice(0, limit)
    .map((application) => ({
      id: application.id,
      fullName: application.person.fullName,
      email: application.person.email,
      cityDistrict: application.person.cityDistrict,
      workplace: application.person.workplace,
      position: application.person.position,
      status: application.status,
      submittedAt: application.submittedAt.toISOString(),
      branchId: application.branchId,
      branchName: application.branch.name,
    }));
}

export interface ApplicationDetail extends ApplicationListRow {
  personId: string;
  birthDate: string | null;
  birthYear: number | null;
  phone: string;
  education: string | null;
  educationLevelCode: string | null;
  educationInstitution: string | null;
  educationProgram: string | null;
  professionalExperience: string | null;
  mathSpecialization: string | null;
  achievements: string | null;
  joiningPurpose: string | null;
  biography: string | null;
  decisionReason: string | null;
  reviewedAt: string | null;
  source: string;
}

export async function getApplicationDetail(user: AppUser, id: string) {
  await ensureDatabase();
  const branches = scopedBranchIds(user);
  const application = await getDb().membershipApplication.findFirst({
    where: { id, archivedAt: null, ...(branches ? { branchId: { in: branches } } : {}) },
    include: {
      person: true,
      branch: true,
      documents: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      notes: {
        where: { archivedAt: null, ...(isFullAccess(user) ? {} : { visibility: "branch" }) },
        include: { author: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        include: { changer: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!application) return null;

  const detail: ApplicationDetail = {
    id: application.id,
    personId: application.personId,
    fullName: application.person.fullName,
    birthDate: date(application.person.birthDate),
    birthYear: application.person.birthYear,
    email: application.person.email,
    phone: application.person.phone,
    cityDistrict: application.person.cityDistrict,
    workplace: application.person.workplace,
    position: application.person.position,
    education: application.person.education,
    educationLevelCode: application.person.educationLevelCode,
    educationInstitution: application.person.educationInstitution,
    educationProgram: application.person.educationProgram,
    professionalExperience: application.person.professionalExperience,
    mathSpecialization: application.person.mathSpecialization,
    achievements: application.person.achievements,
    joiningPurpose: application.joiningPurpose,
    biography: application.person.biography,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    reviewedAt: date(application.reviewedAt),
    decisionReason: application.decisionReason,
    source: application.source,
    branchId: application.branchId,
    branchName: application.branch.name,
  };

  return {
    application: detail,
    documents: application.documents.map((document) => ({ id: document.id, originalName: document.originalName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, status: document.status, createdAt: document.createdAt.toISOString() })),
    notes: application.notes.map((note) => ({ id: note.id, note: note.note, visibility: note.visibility, createdAt: note.createdAt.toISOString(), authorName: note.author.profile?.fullName ?? note.author.email })),
    history: application.statusHistory.map((history) => ({
      previousStatus: history.previousStatus,
      newStatus: history.newStatus,
      reason: history.reason,
      visibility: history.visibility,
      createdAt: history.createdAt.toISOString(),
      actorName: history.changer?.profile?.fullName ?? history.changer?.email ?? "Жүйе",
    })),
  };
}

export interface MemberSearchFilters {
  categoryId?: string;
  branchId?: string;
  membershipStatus?: string;
  query?: string;
  workplace?: string;
  position?: string;
  cityDistrict?: string;
  minimumAge?: number;
  ageUnder?: number;
}

function ageCutoff(age: number) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()));
}

function searchVariants(value: string) {
  const lower = value.toLocaleLowerCase("kk-KZ");
  const upper = value.toLocaleUpperCase("kk-KZ");
  const title = lower ? `${lower[0].toLocaleUpperCase("kk-KZ")}${lower.slice(1)}` : lower;
  return [...new Set([value, lower, upper, title])];
}

export async function listMembers(user: AppUser, filters: MemberSearchFilters = {}, limit = 500) {
  await ensureDatabase();
  const branches = filteredBranchIds(user, filters.branchId);
  const query = filters.query?.trim().slice(0, 120);
  const workplace = filters.workplace?.trim().slice(0, 120);
  const position = filters.position?.trim().slice(0, 120);
  const cityDistrict = filters.cityDistrict?.trim().slice(0, 120);
  const minimumAge = filters.minimumAge && filters.minimumAge >= 18 && filters.minimumAge <= 100 ? filters.minimumAge : undefined;
  const ageUnder = filters.ageUnder && filters.ageUnder >= 19 && filters.ageUnder <= 101 ? filters.ageUnder : undefined;
  const birthDate = minimumAge || ageUnder ? {
    ...(minimumAge ? { lte: ageCutoff(minimumAge) } : {}),
    ...(ageUnder ? { gt: ageCutoff(ageUnder) } : {}),
  } : undefined;
  const textFilters: Prisma.PersonProfileWhereInput[] = [];
  if (workplace) textFilters.push({ OR: searchVariants(workplace).map((value) => ({ workplace: { contains: value, mode: "insensitive" } })) });
  if (position) textFilters.push({ OR: searchVariants(position).map((value) => ({ position: { contains: value, mode: "insensitive" } })) });
  if (cityDistrict) textFilters.push({ OR: searchVariants(cityDistrict).map((value) => ({ cityDistrict: { contains: value, mode: "insensitive" } })) });
  if (query) {
    const variants = searchVariants(query);
    textFilters.push({ OR: variants.flatMap((value) => [
      { fullName: { contains: value, mode: "insensitive" as const } },
      { workplace: { contains: value, mode: "insensitive" as const } },
      { position: { contains: value, mode: "insensitive" as const } },
      { cityDistrict: { contains: value, mode: "insensitive" as const } },
      { mathSpecialization: { contains: value, mode: "insensitive" as const } },
      { educationInstitution: { contains: value, mode: "insensitive" as const } },
    ]) });
  }
  const profiles = await getDb().personProfile.findMany({
    where: {
      archivedAt: null,
      membershipStatus: "member",
      ...(branches ? { branchId: { in: branches } } : {}),
      ...(filters.categoryId ? { professionalCategories: { some: { categoryId: filters.categoryId, removedAt: null } } } : {}),
      ...(birthDate ? { birthDate } : {}),
      ...(textFilters.length ? { AND: textFilters } : {}),
    },
    include: {
      branch: true,
      professionalCategories: {
        where: { removedAt: null },
        include: { category: true },
        orderBy: { category: { sortOrder: "asc" } },
      },
    },
    orderBy: { fullName: "asc" },
    take: limit,
  });
  return profiles.map((profile) => ({
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    birthDate: date(profile.birthDate),
    birthYear: profile.birthYear,
    cityDistrict: profile.cityDistrict,
    workplace: profile.workplace,
    position: profile.position,
    mathSpecialization: profile.mathSpecialization,
    membershipStatus: profile.membershipStatus,
    membershipStartedAt: date(profile.membershipStartedAt),
    branchId: profile.branchId,
    branchName: profile.branch?.name ?? null,
    professionalCategories: profile.professionalCategories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      status: assignment.category.status,
    })),
  }));
}

export async function getMemberDetail(user: AppUser, id: string) {
  await ensureDatabase();
  const branches = scopedBranchIds(user);
  const profile = await getDb().personProfile.findFirst({
    where: { id, archivedAt: null, membershipStatus: { not: "rejected" }, ...(branches ? { branchId: { in: branches } } : {}) },
    include: {
      user: { select: { id: true, emailVerifiedAt: true, status: true, lastLoginAt: true, createdAt: true } },
      branch: true,
      applications: { where: { archivedAt: null }, orderBy: { submittedAt: "desc" } },
      documents: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      statusHistory: {
        include: { changer: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
      },
      professionalCategories: {
        where: { removedAt: null },
        include: { category: true },
        orderBy: { category: { sortOrder: "asc" } },
      },
      departmentAssignments: {
        where: { endedAt: null, department: { archivedAt: null } },
        include: { department: true },
        orderBy: { assignedAt: "asc" },
      },
      activities: {
        include: {
          event: { select: { id: true, slug: true, title: true, startAt: true, status: true } },
          project: { select: { id: true, title: true, status: true } },
        },
        orderBy: { occurredAt: "desc" },
      },
    },
  });
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    surname: profile.surname,
    givenName: profile.givenName,
    patronymic: profile.patronymic,
    birthDate: date(profile.birthDate),
    birthYear: profile.birthYear,
    regionCode: profile.regionCode,
    cityDistrict: profile.cityDistrict,
    phone: profile.phone,
    email: profile.email,
    workplace: profile.workplace,
    position: profile.position,
    education: profile.education,
    educationLevelCode: profile.educationLevelCode,
    educationInstitution: profile.educationInstitution,
    educationProgram: profile.educationProgram,
    professionalExperience: profile.professionalExperience,
    mathSpecialization: profile.mathSpecialization,
    achievements: profile.achievements,
    biography: profile.biography,
    membershipStatus: profile.membershipStatus,
    membershipStartedAt: date(profile.membershipStartedAt),
    branchId: profile.branchId,
    branchName: profile.branch?.name ?? null,
    account: profile.user ? {
      status: profile.user.status,
      emailVerifiedAt: date(profile.user.emailVerifiedAt),
      lastLoginAt: date(profile.user.lastLoginAt),
      createdAt: profile.user.createdAt.toISOString(),
    } : null,
    applications: profile.applications.map((application) => ({
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt.toISOString(),
    })),
    documents: profile.documents.map((document) => ({
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      applicationId: document.applicationId,
      createdAt: document.createdAt.toISOString(),
    })),
    history: profile.statusHistory.map((entry) => ({
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.changer?.profile?.fullName ?? entry.changer?.email ?? "Жүйе",
    })),
    professionalCategories: profile.professionalCategories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      status: assignment.category.status,
    })),
    departments: profile.departmentAssignments.map((assignment) => assignment.department.nameKk),
    activities: profile.activities.map((activity) => ({
      id: activity.id, title: activity.title, description: activity.description, occurredAt: activity.occurredAt.toISOString(),
      status: activity.status, activityType: activity.activityType,
      eventId: activity.eventId, eventSlug: activity.event?.slug ?? null, eventStatus: activity.event?.status ?? null,
      projectId: activity.projectId, projectStatus: activity.project?.status ?? null,
    })),
  };
}

export async function getOwnProfile(user: AppUser) {
  await ensureDatabase();
  const profile = await getDb().personProfile.findFirst({
    where: { id: user.profileId, archivedAt: null },
    include: {
      branch: true,
      documents: { where: { status: { in: ["active", "removal_requested"] }, archivedAt: null }, orderBy: { createdAt: "asc" } },
      statusHistory: { where: { visibility: "member" }, orderBy: { createdAt: "asc" } },
      professionalCategories: {
        where: { removedAt: null },
        include: { category: true },
        orderBy: { category: { sortOrder: "asc" } },
      },
      activities: {
        where: { status: "ACTIVE" },
        include: {
          event: { select: { slug: true, title: true, startAt: true, status: true } },
          project: { select: { id: true, title: true, status: true } },
        },
        orderBy: { occurredAt: "desc" },
      },
      eventRegistrations: {
        where: { registrationStatus: "REGISTERED" },
        include: { event: { select: { slug: true, title: true, startAt: true, status: true } }, attendance: true, seatingUnit: true },
        orderBy: { registeredAt: "desc" },
      },
    },
  });
  if (!profile) return null;
  return {
    id: profile.id,
    full_name: profile.fullName,
    surname: profile.surname,
    given_name: profile.givenName,
    patronymic: profile.patronymic,
    birth_date: date(profile.birthDate),
    birth_year: profile.birthYear,
    region_code: profile.regionCode,
    city_district: profile.cityDistrict,
    phone: profile.phone,
    email: profile.email,
    workplace: profile.workplace,
    position: profile.position,
    education: profile.education,
    education_level_code: profile.educationLevelCode,
    education_institution: profile.educationInstitution,
    education_program: profile.educationProgram,
    professional_experience: profile.professionalExperience,
    math_specialization: profile.mathSpecialization,
    achievements: profile.achievements,
    biography: profile.biography,
    membership_status: profile.membershipStatus,
    membership_started_at: date(profile.membershipStartedAt),
    branchName: profile.branch?.name ?? null,
    professionalCategories: profile.professionalCategories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      status: assignment.category.status,
    })),
    activities: profile.activities.map((activity) => ({
      id: activity.id, title: activity.title, description: activity.description, occurredAt: activity.occurredAt.toISOString(),
      activityType: activity.activityType,
      eventSlug: activity.event?.slug ?? null, eventStatus: activity.event?.status ?? null,
      projectId: activity.projectId, projectStatus: activity.project?.status ?? null,
    })),
    eventRegistrations: profile.eventRegistrations.map((registration) => ({
      id: registration.id, eventTitle: registration.event.title, eventSlug: registration.event.slug,
      startAt: registration.event.startAt.toISOString(), eventStatus: registration.event.status,
      attendanceStatus: registration.attendance?.status ?? "PENDING",
      seat: registration.seatingUnit ? `${registration.seatingUnit.label}-${registration.seatNumber}` : null,
    })),
    documents: profile.documents.map((document) => ({
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      applicationId: document.applicationId,
      draftId: document.draftId,
      createdAt: document.createdAt.toISOString(),
    })),
    visibleHistory: profile.statusHistory.map((history) => ({ newStatus: history.newStatus, createdAt: history.createdAt.toISOString() })),
  };
}

export async function listBranches(user?: AppUser) {
  await ensureDatabase();
  const scopedIds = user && !isFullAccess(user) ? branchScopeIds(user) : null;
  const branches = await getDb().branch.findMany({
    where: { archivedAt: null, ...(scopedIds ? { id: { in: scopedIds } } : {}) },
    include: { directorProfile: true, profiles: { where: { archivedAt: null }, select: { membershipStatus: true } } },
    orderBy: { regionName: "asc" },
  });
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    regionCode: branch.regionCode,
    regionName: branch.regionName,
    status: branch.status,
    directorName: branch.directorProfile?.fullName ?? null,
    memberCount: branch.profiles.filter((profile) => profile.membershipStatus === "member").length,
    applicantCount: branch.profiles.filter((profile) => profile.membershipStatus === "applicant").length,
    reserveCount: branch.profiles.filter((profile) => profile.membershipStatus === "reserve").length,
  }));
}

export async function listDocumentRemovalRequests() {
  await ensureDatabase();
  const database = getDb();
  const documents = await database.uploadedDocument.findMany({
    where: { status: "removal_requested", archivedAt: null },
    include: { owner: { include: { branch: true } }, application: true },
    orderBy: { updatedAt: "asc" },
  });
  const audits = documents.length ? await database.auditLog.findMany({
    where: { actionType: "document.removal_requested", targetEntity: "uploaded_document", targetEntityId: { in: documents.map((document) => document.id) } },
    orderBy: { createdAt: "desc" },
  }) : [];
  return documents.map((document) => ({
    id: document.id,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    requestedAt: document.updatedAt.toISOString(),
    ownerPersonId: document.ownerPersonId,
    ownerName: document.owner.fullName,
    ownerEmail: document.owner.email,
    branchName: document.owner.branch?.name ?? null,
    applicationId: document.applicationId,
    reason: audits.find((audit) => audit.targetEntityId === document.id)?.reason ?? null,
  }));
}

export async function listProfessionalProfiles(user: AppUser, filters: { categoryId?: string; branchId?: string } = {}) {
  await ensureDatabase();
  const nationwide = isNationwideProfessionalAccess(user);
  const departmentIds = departmentScopeIds(user);
  const profiles = await getDb().personProfile.findMany({
    where: {
      membershipStatus: "member",
      archivedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.categoryId ? { professionalCategories: { some: { categoryId: filters.categoryId, removedAt: null } } } : {}),
      ...(nationwide ? {} : {
        departmentAssignments: {
          some: { departmentId: { in: departmentIds }, endedAt: null, department: { archivedAt: null } },
        },
      }),
    },
    include: {
      branch: { select: { regionName: true } },
      departmentAssignments: {
        where: {
          endedAt: null,
          department: { archivedAt: null },
          ...(nationwide ? {} : { departmentId: { in: departmentIds } }),
        },
        include: { department: { select: { id: true, nameKk: true } } },
      },
      professionalCategories: {
        where: { removedAt: null },
        include: { category: true },
        orderBy: { category: { sortOrder: "asc" } },
      },
    },
    orderBy: { fullName: "asc" },
  });
  return profiles.map((profile) => ({
    id: profile.id,
    fullName: profile.fullName,
    workplace: profile.workplace,
    position: profile.position,
    specialization: profile.mathSpecialization,
    regionName: profile.branch?.regionName ?? null,
    departments: profile.departmentAssignments.map((assignment) => assignment.department.nameKk),
    professionalCategories: profile.professionalCategories.map((assignment) => ({
      id: assignment.category.id,
      name: assignment.category.name,
      status: assignment.category.status,
    })),
  }));
}

export async function listProfessionalCategories(options: { activeOnly?: boolean } = {}) {
  await ensureDatabase();
  const rows = await getDb().professionalCategory.findMany({
    where: options.activeOnly ? { status: "active" } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    status: category.status,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }));
}

export async function getProfessionalCategoryAdminData() {
  await ensureDatabase();
  const rows = await getDb().professionalCategory.findMany({
    include: { assignments: { select: { personId: true, removedAt: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    status: category.status,
    activeAssignmentCount: category.assignments.filter((assignment) => assignment.removedAt === null).length,
    historicalPersonCount: new Set(category.assignments.map((assignment) => assignment.personId)).size,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }));
}

export async function listAuditLogs(limit = 80) {
  await ensureDatabase();
  const logs = await getDb().auditLog.findMany({
    include: { actor: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return logs.map((log) => ({
    id: log.id,
    actionType: log.actionType,
    targetEntity: log.targetEntity,
    targetEntityId: log.targetEntityId,
    previousValue: log.previousValue,
    newValue: log.newValue,
    reason: log.reason,
    ipAddress: log.ipAddress,
    sessionId: log.sessionId,
    createdAt: log.createdAt.toISOString(),
    actorName: log.actor?.profile?.fullName ?? null,
  }));
}

export async function listUsersAndRoles() {
  await ensureDatabase();
  const database = getDb();
  const [userRows, assignmentRows, roleRows, departmentRows, departmentAssignmentRows] = await Promise.all([
    database.user.findMany({ where: { archivedAt: null }, include: { profile: { include: { branch: true } } }, orderBy: { profile: { fullName: "asc" } } }),
    database.userRole.findMany({ where: { revokedAt: null }, include: { role: true }, orderBy: { role: { nameKk: "asc" } } }),
    database.role.findMany({ orderBy: [{ accessLevel: "asc" }, { nameKk: "asc" }] }),
    database.department.findMany({
      where: { archivedAt: null },
      include: {
        parent: { select: { id: true, nameKk: true } },
        _count: {
          select: {
            children: { where: { archivedAt: null } },
            assignments: { where: { endedAt: null } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { nameKk: "asc" }],
    }),
    database.personDepartmentAssignment.findMany({
      where: { endedAt: null },
      include: { department: true },
      orderBy: { assignedAt: "asc" },
    }),
  ]);
  return {
    users: userRows.filter((user) => user.profile).map((user) => ({ id: user.id, personId: user.profile!.id, email: user.email, fullName: user.profile!.fullName, membershipStatus: user.profile!.membershipStatus, branchId: user.profile!.branchId, branchName: user.profile!.branch?.name ?? null })),
    assignments: assignmentRows.map((assignment) => ({ id: assignment.id, userId: assignment.userId, slug: assignment.role.slug, nameKk: assignment.role.nameKk, scopeType: assignment.scopeType, scopeId: assignment.scopeId })),
    roles: roleRows.map((role) => ({ id: role.id, slug: role.slug, nameKk: role.nameKk, accessLevel: role.accessLevel })),
    departments: departmentRows.map((department) => ({
      id: department.id,
      nameKk: department.nameKk,
      unitType: department.unitType,
      parentId: department.parentId,
      parentName: department.parent?.nameKk ?? null,
      description: department.description,
      sortOrder: department.sortOrder,
      activeChildCount: department._count.children,
      activeMemberCount: department._count.assignments,
      activeRoleCount: assignmentRows.filter((assignment) => assignment.scopeType === "department" && assignment.scopeId === department.id).length,
    })),
    departmentAssignments: departmentAssignmentRows.map((assignment) => ({
      id: assignment.id,
      personId: assignment.personId,
      departmentId: assignment.departmentId,
      departmentName: assignment.department.nameKk,
    })),
  };
}

export async function getPublicContentValues(): Promise<PublicContentValues> {
  await ensureDatabase();
  const values = defaultPublicContent();
  const rows = await getDb().publicContent.findMany({ select: { key: true, value: true } });
  for (const row of rows) {
    if (row.key in values) values[row.key as keyof PublicContentValues] = row.value;
  }
  return values;
}

export async function recordAudit(input: {
  actorUserId?: string | null;
  actionType: string;
  targetEntity: string;
  targetEntityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  sessionId?: string | null;
}) {
  await ensureDatabase();
  await getDb().auditLog.create({
    data: {
      id: crypto.randomUUID(),
      actorUserId: input.actorUserId ?? null,
      actionType: input.actionType,
      targetEntity: input.targetEntity,
      targetEntityId: input.targetEntityId,
      previousValue: input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      sessionId: input.sessionId ?? null,
      createdAt: new Date(),
    },
  });
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  await ensureDatabase();
  const now = Math.floor(Date.now() / 1000);
  const rows = await getDb().$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "rate_limits" ("key", "window_start", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "window_start" = CASE
        WHEN EXCLUDED."window_start" - "rate_limits"."window_start" >= ${windowSeconds}
        THEN EXCLUDED."window_start" ELSE "rate_limits"."window_start" END,
      "count" = CASE
        WHEN EXCLUDED."window_start" - "rate_limits"."window_start" >= ${windowSeconds}
        THEN 1 ELSE "rate_limits"."count" + 1 END
    RETURNING "count"
  `);
  return (rows[0]?.count ?? limit + 1) <= limit;
}
