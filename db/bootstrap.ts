import { getDb } from "./index";
import { hashPassword } from "@/lib/security";
import { runtimeEnv } from "@/lib/runtime-env";
import { publicContentSeedRows } from "@/lib/public-content";
import { ensureDatabasePasswordVerifier } from "./password";
import { ensureAccountFlowSchema } from "./account-flow-schema";

const roles = [
  ["role-member", "member", "Бірлестік мүшесі", "D", "Тек өзінің профилі"],
  ["role-branch-staff", "branch_staff", "Филиал қызметкері", "C", "Өз филиалының операциялары"],
  ["role-branch-event-manager", "branch_event_manager", "Филиал іс-шаралары үйлестірушісі", "C", "Тек берілген филиалдың іс-шара жобаларын басқарады"],
  ["role-branch-project-manager", "branch_project_manager", "Филиал жобалары үйлестірушісі", "C", "Тек берілген филиалдың жобаларын басқарады"],
  ["role-branch-director", "branch_director", "Филиал директоры", "C", "Өз филиалына жауапты"],
  ["role-department-staff", "department_staff", "Департамент қызметкері", "B", "Кәсіби міндет шегіндегі қолжетімділік"],
  ["role-department-head", "department_head", "Департамент басшысы", "B", "Департамент шегіндегі қолжетімділік"],
  ["role-vp1", "vice_president_1", "I вице-президент", "B", "Математика, мазмұн және кәсіби даму"],
  ["role-vp2", "vice_president_2", "II вице-президент", "A", "Ұйымдық және институционалдық даму"],
  ["role-president", "president", "Президент", "A", "Толық қолжетімділік"],
] as const;

const permissions = [
  ["permission-profile-own-read", "profile.own.read", "Өз профилін көру"],
  ["permission-profile-own-update", "profile.own.update", "Рұқсат етілген профиль өрістерін өзгерту"],
  ["permission-branch-applications-read", "applications.branch.read", "Өз филиалының өтініштерін көру"],
  ["permission-branch-applications-decide", "applications.branch.decide", "Өз филиалының өтініштеріне шешім шығару"],
  ["permission-branch-documents-read", "documents.branch.read", "Өз филиалының өтініш құжаттарын көру"],
  ["permission-branch-members-read", "members.branch.read", "Өз филиалының мүшелерін көру"],
  ["permission-department-professional-read", "department.professional.read", "Қажетті кәсіби деректерді көру"],
  ["permission-all-read", "all.read", "Барлық институционалдық деректі көру"],
  ["permission-all-write", "all.write", "Әкімшілік деректерді басқару"],
  ["permission-roles-manage", "roles.manage", "Рөлдерді басқару"],
  ["permission-audit-read", "audit.read", "Аудит журналын көру"],
  ["permission-branches-manage", "branches.manage", "Филиалдарды басқару"],
  ["permission-public-content-manage", "public_content.manage", "Ашық сайт мазмұнын басқару"],
  ["permission-events-manage-global", "events.manage_global", "Барлық іс-шараны құру және өңдеу"],
  ["permission-events-manage-branch", "events.manage_branch", "Берілген филиалдың іс-шара жобаларын құру және өңдеу"],
  ["permission-events-publish", "events.publish", "Іс-шараны жариялау және тарихи мәртебесін басқару"],
  ["permission-events-results-manage", "events.results.manage", "Іс-шараның құрылымдалған қорытындысын басқару"],
  ["permission-events-news-generate", "events.news.generate", "Іс-шарадан жаңалық жобасын жасау"],
  ["permission-professional-categories-catalog-manage", "professional_categories.catalog.manage", "Кәсіби санаттар каталогын басқару"],
  ["permission-professional-categories-assign", "professional_categories.assign", "Кәсіби санаттарды профильдерге ресми тағайындау"],
  ["permission-events-participants-read", "events.participants.read", "Іс-шара қатысушыларының тізімін scope шегінде көру"],
  ["permission-events-participants-manage", "events.participants.manage", "Іс-шара қатысушыларын scope шегінде басқару"],
  ["permission-events-attendance-manage", "events.attendance.manage", "Іс-шараға қатысуды scope шегінде белгілеу"],
  ["permission-events-seating-manage", "events.seating.manage", "Іс-шарадағы орындарды scope шегінде басқару"],
  ["permission-projects-read", "projects.read", "Жобаларды өз scope шегінде көру"],
  ["permission-projects-manage-global", "projects.manage_global", "Республикалық жобаларды басқару"],
  ["permission-projects-manage-branch", "projects.manage_branch", "Филиал жобаларын өз scope шегінде басқару"],
  ["permission-projects-manage-department", "projects.manage_department", "Жауапты департамент жобаларын өз scope шегінде басқару"],
  ["permission-projects-participants-manage", "projects.participants.manage", "Жоба қатысушыларын өз scope шегінде басқару"],
  ["permission-projects-stages-manage", "projects.stages.manage", "Жоба кезеңдерін өз scope шегінде басқару"],
  ["permission-projects-documents-manage", "projects.documents.manage", "Жоба құжаттарын өз scope шегінде басқару"],
  ["permission-projects-results-manage", "projects.results.manage", "Жоба нәтижесін өз scope шегінде басқару"],
  ["permission-reports-read", "reports.read", "Рұқсат етілген scope шегіндегі басқару есептерін көру"],
  ["permission-reports-export", "reports.export", "Рұқсат етілген scope шегіндегі есептерді Excel және PDF түрінде шығару"],
  ["permission-institutional-documents-read", "institutional_documents.read", "Қолжетімділік деңгейі мен scope шегіндегі ішкі ресми құжаттарды көру"],
  ["permission-institutional-documents-manage-global", "institutional_documents.manage_global", "Барлық ішкі ресми құжатты басқару"],
  ["permission-institutional-documents-manage-branch", "institutional_documents.manage_branch", "Өз филиалының ішкі ресми құжаттарын басқару"],
  ["permission-institutional-documents-manage-department", "institutional_documents.manage_department", "Өз департаментінің ішкі ресми құжаттарын басқару"],
] as const;

const initialProfessionalCategories = [
  ["professional-category-mathematician-scientist", "Математик-ғалым", 10],
  ["professional-category-mathematics-teacher", "Математика мұғалімі", 20],
  ["professional-category-olympiad-mathematics", "Олимпиадалық математика өкілі", 30],
  ["professional-category-mathematics-enthusiast", "Математикаға қызығушылығы бар тұлға", 40],
] as const;

const userSeeds = [
  ["user-president", "president@example.test", "person-president", "Президент рөлі (сынақ)", 1978, "astana", "Астана", "0000000001", "Сынақ дерегі", "Президент", "Сынақ дерегі", "25 жыл", "Математикалық талдау", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-astana", "2020-01-15", "role-president", "global", null],
  ["user-vp1", "vp1@example.test", "person-vp1", "I вице-президент рөлі (сынақ)", 1981, "almaty", "Алматы", "0000000002", "Сынақ дерегі", "I вице-президент", "Сынақ дерегі", "21 жыл", "Алгебра", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-almaty", "2020-02-01", "role-vp1", "department", "dept-content"],
  ["user-vp2", "vp2@example.test", "person-vp2", "II вице-президент рөлі (сынақ)", 1984, "astana", "Астана", "0000000003", "Сынақ дерегі", "II вице-президент", "Сынақ дерегі", "18 жыл", "Математикалық білім", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-astana", "2021-03-12", "role-vp2", "global", null],
  ["user-dept-head", "department@example.test", "person-dept-head", "Департамент басшысы рөлі (сынақ)", 1986, "karaganda", "Қарағанды", "0000000004", "Сынақ дерегі", "Департамент басшысы", "Сынақ дерегі", "16 жыл", "Геометрия", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-karaganda", "2022-05-06", "role-department-head", "department", "dept-content"],
  ["user-branch-director", "branch@example.test", "person-branch-director", "Филиал директоры рөлі (сынақ)", 1987, "almaty", "Алматы", "0000000005", "Сынақ дерегі", "Филиал директоры", "Сынақ дерегі", "15 жыл", "Ықтималдықтар теориясы", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-almaty", "2022-08-20", "role-branch-director", "branch", "branch-almaty"],
  ["user-member", "member@example.test", "person-member", "Мүше рөлі (сынақ)", 1992, "almaty", "Алматы", "0000000006", "Сынақ дерегі", "Математика мұғалімі", "Сынақ дерегі", "10 жыл", "Комбинаторика", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "member", "branch-almaty", "2024-01-18", "role-member", "global", null],
  ["user-applicant", "applicant@example.test", "person-applicant", "Үміткер рөлі (сынақ)", 1995, "almaty", "Алматы", "0000000007", "Сынақ дерегі", "Оқытушы", "Сынақ дерегі", "7 жыл", "Математиканы оқыту әдістемесі", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "applicant", "branch-almaty", null, null, "global", null],
  ["user-reserve", "reserve@example.test", "person-reserve", "Резерв рөлі (сынақ)", 1990, "east", "Өскемен", "0000000008", "Сынақ дерегі", "Аға оқытушы", "Сынақ дерегі", "11 жыл", "Қолданбалы математика", "Сынақ дерегі", "Сынақ профилі. Ресми тұлға туралы ақпарат емес.", "reserve", "branch-east", null, null, "global", null],
] as const;

const regionCatalog = [
  ["branch-astana", "Астана қалалық филиалы", "astana", "Астана қаласы"],
  ["branch-almaty", "Алматы қалалық филиалы", "almaty", "Алматы қаласы"],
  ["branch-shymkent", "Шымкент қаласы", "shymkent", "Шымкент қаласы"],
  ["branch-abai", "Абай облысы", "abai", "Абай облысы"],
  ["branch-akmola", "Ақмола облысы", "akmola", "Ақмола облысы"],
  ["branch-aktobe", "Ақтөбе облысы", "aktobe", "Ақтөбе облысы"],
  ["branch-almaty-oblysy", "Алматы облысы", "almaty-oblysy", "Алматы облысы"],
  ["branch-atyrau", "Атырау облысы", "atyrau", "Атырау облысы"],
  ["branch-batys-qazaqstan", "Батыс Қазақстан облысы", "batys-qazaqstan", "Батыс Қазақстан облысы"],
  ["branch-zhambyl", "Жамбыл облысы", "zhambyl", "Жамбыл облысы"],
  ["branch-zhetisu", "Жетісу облысы", "zhetisu", "Жетісу облысы"],
  ["branch-karaganda", "Қарағанды облыстық филиалы", "karaganda", "Қарағанды облысы"],
  ["branch-kostanay", "Қостанай облысы", "kostanay", "Қостанай облысы"],
  ["branch-kyzylorda", "Қызылорда облысы", "kyzylorda", "Қызылорда облысы"],
  ["branch-mangystau", "Маңғыстау облысы", "mangystau", "Маңғыстау облысы"],
  ["branch-pavlodar", "Павлодар облысы", "pavlodar", "Павлодар облысы"],
  ["branch-soltustik-qazaqstan", "Солтүстік Қазақстан облысы", "soltustik-qazaqstan", "Солтүстік Қазақстан облысы"],
  ["branch-turkistan", "Түркістан облыстық филиалы", "turkistan", "Түркістан облысы"],
  ["branch-ulytau", "Ұлытау облысы", "ulytau", "Ұлытау облысы"],
  ["branch-east", "Шығыс Қазақстан облыстық филиалы", "east", "Шығыс Қазақстан облысы"],
] as const;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export async function seedDatabase(database = getDb()) {
  if ((await database.user.count()) > 0) return;

  const now = new Date();
  const passwordHash = await hashPassword("PhaseOneDemo2026!");
  const permissionMap: Record<string, string[]> = {
    member: ["permission-profile-own-read", "permission-profile-own-update", "permission-institutional-documents-read"],
    branch_staff: ["permission-branch-applications-read", "permission-branch-applications-decide", "permission-branch-documents-read", "permission-branch-members-read", "permission-reports-read", "permission-reports-export", "permission-institutional-documents-read"],
    branch_event_manager: ["permission-events-manage-branch", "permission-events-results-manage", "permission-events-news-generate", "permission-events-participants-read", "permission-events-participants-manage", "permission-events-attendance-manage", "permission-events-seating-manage"],
    branch_project_manager: ["permission-projects-read", "permission-projects-manage-branch", "permission-projects-participants-manage", "permission-projects-stages-manage", "permission-projects-documents-manage", "permission-projects-results-manage"],
    branch_director: ["permission-branch-applications-read", "permission-branch-applications-decide", "permission-branch-documents-read", "permission-branch-members-read", "permission-events-manage-branch", "permission-events-results-manage", "permission-events-news-generate", "permission-events-participants-read", "permission-events-participants-manage", "permission-events-attendance-manage", "permission-events-seating-manage", "permission-projects-read", "permission-projects-manage-branch", "permission-projects-participants-manage", "permission-projects-stages-manage", "permission-projects-documents-manage", "permission-projects-results-manage", "permission-reports-read", "permission-reports-export", "permission-institutional-documents-read", "permission-institutional-documents-manage-branch"],
    department_staff: ["permission-department-professional-read", "permission-institutional-documents-read"],
    department_head: ["permission-department-professional-read", "permission-projects-read", "permission-projects-manage-department", "permission-projects-participants-manage", "permission-projects-stages-manage", "permission-projects-documents-manage", "permission-projects-results-manage", "permission-institutional-documents-read", "permission-institutional-documents-manage-department"],
    vice_president_1: ["permission-department-professional-read", "permission-institutional-documents-read"],
    vice_president_2: permissions.map((permission) => permission[0]),
    president: permissions.map((permission) => permission[0]),
  };

  await database.$transaction(async (tx) => {
    await tx.branch.createMany({
      data: regionCatalog.map(([id, name, regionCode, regionName]) => ({ id, name, regionCode, regionName, status: "active", createdAt: now, updatedAt: now })),
      skipDuplicates: true,
    });
    await tx.role.createMany({
      data: roles.map(([id, slug, nameKk, accessLevel, description]) => ({ id, slug, nameKk, accessLevel, description, createdAt: now })),
      skipDuplicates: true,
    });
    await tx.permission.createMany({
      data: permissions.map(([id, slug, description]) => ({ id, slug, description, createdAt: now })),
      skipDuplicates: true,
    });
    await tx.professionalCategory.createMany({
      data: initialProfessionalCategories.map(([id, name, sortOrder]) => ({ id, name, sortOrder, status: "active", createdAt: now, updatedAt: now })),
      skipDuplicates: true,
    });
    await tx.department.createMany({
      data: [{
        id: "dept-content", code: "mathematics-content-professional-development",
        nameKk: "Математика, мазмұн және кәсіби даму департаменті",
        nameKey: "математика, мазмұн және кәсіби даму департаменті",
        description: "Phase 1 кәсіби міндеттеріне арналған ішкі бөлім", createdAt: now, updatedAt: now,
      }],
      skipDuplicates: true,
    });
    await tx.rolePermission.createMany({
      data: roles.flatMap(([roleId, slug]) => permissionMap[slug].map((permissionId) => ({ id: `rp-${slug}-${permissionId}`, roleId, permissionId, createdAt: now }))),
      skipDuplicates: true,
    });

    for (const seed of userSeeds) {
      const [userId, email, personId, fullName, birthYear, regionCode, cityDistrict, phone, workplace, position, education, professionalExperience, mathSpecialization, achievements, biography, membershipStatus, branchId, membershipStartedAt, roleId, scopeType, scopeId] = seed;
      await tx.user.create({ data: { id: userId, email, passwordHash, emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now } });
      await tx.personProfile.create({
        data: {
          id: personId, userId, fullName, birthYear, regionCode, cityDistrict, phone, email,
          workplace, position, education, professionalExperience, mathSpecialization, achievements,
          biography, membershipStatus, membershipStartedAt: membershipStartedAt ? new Date(membershipStartedAt) : null,
          branchId, createdAt: now, updatedAt: now,
        },
      });
      if (roleId) {
        await tx.userRole.create({ data: { id: `assignment-${userId}`, userId, roleId, scopeType, scopeId, grantedBy: "user-president", grantedAt: now } });
      }
    }

    await tx.branchStaff.create({ data: { id: "staff-almaty-director", branchId: "branch-almaty", userId: "user-branch-director", staffType: "director", activeFrom: daysAgo(600), createdAt: now } });
    await tx.branch.update({ where: { id: "branch-almaty" }, data: { directorProfileId: "person-branch-director" } });
    await tx.personDepartmentAssignment.createMany({ data: [
      { id: "department-assignment-head", personId: "person-dept-head", departmentId: "dept-content", assignedBy: "user-president", assignedAt: now },
      { id: "department-assignment-member", personId: "person-member", departmentId: "dept-content", assignedBy: "user-president", assignedAt: now },
    ] });
    await tx.membershipApplication.createMany({ data: [
      { id: "application-awaiting", personId: "person-applicant", branchId: "branch-almaty", status: "awaiting_review", submittedAt: daysAgo(3), termsVersion: "2026.1", termsAcceptedAt: daysAgo(3), source: "web" },
      { id: "application-reserve", personId: "person-reserve", branchId: "branch-east", status: "reserve", submittedAt: daysAgo(18), reviewedAt: daysAgo(12), reviewedBy: "user-president", decisionReason: "Қосымша кәсіби тәжірибе туралы мәлімет қажет.", termsVersion: "2026.1", termsAcceptedAt: daysAgo(18), source: "qr" },
    ] });
    await tx.membershipStatusHistory.createMany({ data: [
      { id: "history-applicant", personId: "person-applicant", applicationId: "application-awaiting", previousStatus: "registered_user", newStatus: "applicant", reason: "Өтініш қабылданды", visibility: "member", changedBy: "user-applicant", createdAt: daysAgo(3) },
      { id: "history-reserve", personId: "person-reserve", applicationId: "application-reserve", previousStatus: "applicant", newStatus: "reserve", reason: "Қосымша кәсіби тәжірибе туралы мәлімет қажет.", visibility: "internal", changedBy: "user-president", createdAt: daysAgo(12) },
    ] });
    await tx.internalNote.create({ data: { id: "note-reserve", personId: "person-reserve", applicationId: "application-reserve", branchId: "branch-east", authorUserId: "user-president", note: "Кәсіби портфолио толықтырылғаннан кейін қайта қарау.", visibility: "central", createdAt: daysAgo(12) } });
    await tx.auditLog.create({ data: { id: "audit-reserve", actorUserId: "user-president", actionType: "application.reserve", targetEntity: "membership_application", targetEntityId: "application-reserve", previousValue: JSON.stringify({ status: "applicant" }), newValue: JSON.stringify({ status: "reserve" }), reason: "Қосымша кәсіби мәлімет қажет", ipAddress: "127.0.0.1", sessionId: "seed-session", createdAt: daysAgo(12) } });
    await tx.applicationFieldDefinition.createMany({ data: [
      { id: "field-achievements", fieldKey: "achievements", labelKk: "Кәсіби жетістіктер", fieldType: "textarea", required: false, sortOrder: 10, enabled: true, createdAt: now, updatedAt: now },
      { id: "field-biography", fieldKey: "biography", labelKk: "Қысқаша кәсіби өмірбаян", fieldType: "textarea", required: true, sortOrder: 20, enabled: true, createdAt: now, updatedAt: now },
    ] });
    await tx.publicContent.createMany({
      data: publicContentSeedRows.map((row) => ({ ...row, createdAt: now, updatedAt: now })),
      skipDuplicates: true,
    });
  });
}

let initialization: Promise<void> | null = null;

async function ensureRegionCatalog(database = getDb()) {
  const now = new Date();
  const catalogJson = JSON.stringify(regionCatalog.map(([id, name, regionCode, regionName]) => ({
    id,
    name,
    region_code: regionCode,
    region_name: regionName,
  })));

  await database.$executeRaw`
    WITH catalog AS (
      SELECT *
      FROM jsonb_to_recordset(${catalogJson}::jsonb) AS item(
        id text,
        name text,
        region_code text,
        region_name text
      )
    ),
    synchronized AS (
      INSERT INTO branches (id, name, region_code, region_name, status, created_at, updated_at)
      SELECT id, name, region_code, region_name, 'active', ${now}, ${now}
      FROM catalog
      ON CONFLICT (region_code) DO UPDATE SET
        region_name = EXCLUDED.region_name,
        updated_at = EXCLUDED.updated_at
      WHERE branches.region_name IS DISTINCT FROM EXCLUDED.region_name
      RETURNING id
    )
    INSERT INTO audit_logs (
      id,
      action_type,
      target_entity,
      target_entity_id,
      new_value,
      reason,
      created_at
    )
    SELECT
      'audit-region-catalog-20260817',
      'branch_catalog.regions_synchronized',
      'branch_catalog',
      'kazakhstan-regions',
      ${JSON.stringify({ regions: regionCatalog.map(([, , regionCode, regionName]) => ({ regionCode, regionName })) })},
      'Мүшелік өтінішіне арналған өңірлер каталогы енгізілді',
      ${now}
    WHERE EXISTS (SELECT 1 FROM synchronized)
    ON CONFLICT (id) DO NOTHING
  `;
}

export function ensureDatabase() {
  initialization ??= runtimeEnv("ENVIRONMENT") === "production"
    ? Promise.resolve()
    : ensureAccountFlowSchema().then(() => seedDatabase()).then(() => ensureRegionCatalog()).then(() => ensureDatabasePasswordVerifier());
  return initialization;
}
