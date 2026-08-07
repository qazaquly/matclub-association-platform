import { getRawDb } from "./index";
import { hashPassword } from "@/lib/security";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS branches (id text PRIMARY KEY NOT NULL, name text NOT NULL, region_code text NOT NULL, region_name text NOT NULL, status text DEFAULT 'active' NOT NULL, director_profile_id text, created_at text NOT NULL, updated_at text NOT NULL, archived_at text)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS branches_region_code_unique ON branches (region_code)`,
  `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, email text NOT NULL, password_hash text, status text DEFAULT 'active' NOT NULL, last_login_at text, created_at text NOT NULL, updated_at text NOT NULL, archived_at text)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  `CREATE TABLE IF NOT EXISTS person_profiles (id text PRIMARY KEY NOT NULL, user_id text, full_name text NOT NULL, birth_year integer, region_code text NOT NULL, city_district text NOT NULL, phone text NOT NULL, email text NOT NULL, workplace text, position text, education text, professional_experience text, math_specialization text, achievements text, biography text, membership_status text DEFAULT 'registered_user' NOT NULL, membership_started_at text, branch_id text, created_at text NOT NULL, updated_at text NOT NULL, archived_at text, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (branch_id) REFERENCES branches(id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS person_profiles_user_id_unique ON person_profiles (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS person_profiles_email_unique ON person_profiles (email)`,
  `CREATE INDEX IF NOT EXISTS person_profiles_branch_idx ON person_profiles (branch_id)`,
  `CREATE INDEX IF NOT EXISTS person_profiles_membership_status_idx ON person_profiles (membership_status)`,
  `CREATE TABLE IF NOT EXISTS roles (id text PRIMARY KEY NOT NULL, slug text NOT NULL, name_kk text NOT NULL, access_level text NOT NULL, description text, created_at text NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS roles_slug_unique ON roles (slug)`,
  `CREATE TABLE IF NOT EXISTS permissions (id text PRIMARY KEY NOT NULL, slug text NOT NULL, description text NOT NULL, created_at text NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS permissions_slug_unique ON permissions (slug)`,
  `CREATE TABLE IF NOT EXISTS role_permissions (id text PRIMARY KEY NOT NULL, role_id text NOT NULL, permission_id text NOT NULL, created_at text NOT NULL, FOREIGN KEY (role_id) REFERENCES roles(id), FOREIGN KEY (permission_id) REFERENCES permissions(id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_unique ON role_permissions (role_id, permission_id)`,
  `CREATE TABLE IF NOT EXISTS user_roles (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, role_id text NOT NULL, scope_type text DEFAULT 'global' NOT NULL, scope_id text, granted_by text, granted_at text NOT NULL, revoked_at text, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (role_id) REFERENCES roles(id), FOREIGN KEY (granted_by) REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles (user_id)`,
  `CREATE TABLE IF NOT EXISTS branch_staff (id text PRIMARY KEY NOT NULL, branch_id text NOT NULL, user_id text NOT NULL, staff_type text NOT NULL, active_from text NOT NULL, active_to text, created_at text NOT NULL, FOREIGN KEY (branch_id) REFERENCES branches(id), FOREIGN KEY (user_id) REFERENCES users(id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS branch_staff_active_unique ON branch_staff (branch_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS membership_applications (id text PRIMARY KEY NOT NULL, person_id text NOT NULL, branch_id text NOT NULL, status text DEFAULT 'awaiting_review' NOT NULL, submitted_at text NOT NULL, reviewed_at text, reviewed_by text, decision_reason text, terms_version text NOT NULL, terms_accepted_at text NOT NULL, source text DEFAULT 'web' NOT NULL, archived_at text, FOREIGN KEY (person_id) REFERENCES person_profiles(id), FOREIGN KEY (branch_id) REFERENCES branches(id), FOREIGN KEY (reviewed_by) REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS membership_applications_branch_idx ON membership_applications (branch_id)`,
  `CREATE INDEX IF NOT EXISTS membership_applications_status_idx ON membership_applications (status)`,
  `CREATE TABLE IF NOT EXISTS membership_status_history (id text PRIMARY KEY NOT NULL, person_id text NOT NULL, application_id text, previous_status text, new_status text NOT NULL, reason text, visibility text DEFAULT 'internal' NOT NULL, changed_by text, created_at text NOT NULL, FOREIGN KEY (person_id) REFERENCES person_profiles(id), FOREIGN KEY (application_id) REFERENCES membership_applications(id), FOREIGN KEY (changed_by) REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS membership_status_history_person_idx ON membership_status_history (person_id)`,
  `CREATE TABLE IF NOT EXISTS uploaded_documents (id text PRIMARY KEY NOT NULL, owner_person_id text NOT NULL, application_id text, uploaded_by text, object_key text NOT NULL, original_name text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, checksum_sha256 text NOT NULL, visibility text DEFAULT 'reviewers' NOT NULL, status text DEFAULT 'active' NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, archived_at text, FOREIGN KEY (owner_person_id) REFERENCES person_profiles(id), FOREIGN KEY (application_id) REFERENCES membership_applications(id), FOREIGN KEY (uploaded_by) REFERENCES users(id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uploaded_documents_object_key_unique ON uploaded_documents (object_key)`,
  `CREATE TABLE IF NOT EXISTS internal_notes (id text PRIMARY KEY NOT NULL, person_id text, application_id text, branch_id text, author_user_id text NOT NULL, note text NOT NULL, visibility text DEFAULT 'central' NOT NULL, created_at text NOT NULL, archived_at text, FOREIGN KEY (person_id) REFERENCES person_profiles(id), FOREIGN KEY (application_id) REFERENCES membership_applications(id), FOREIGN KEY (branch_id) REFERENCES branches(id), FOREIGN KEY (author_user_id) REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS internal_notes_application_idx ON internal_notes (application_id)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY NOT NULL, actor_user_id text, action_type text NOT NULL, target_entity text NOT NULL, target_entity_id text NOT NULL, previous_value text, new_value text, reason text, ip_address text, session_id text, created_at text NOT NULL, FOREIGN KEY (actor_user_id) REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_entity, target_entity_id)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at)`,
  `CREATE TRIGGER IF NOT EXISTS prevent_audit_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS prevent_audit_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END`,
  `CREATE TABLE IF NOT EXISTS application_field_definitions (id text PRIMARY KEY NOT NULL, field_key text NOT NULL, label_kk text NOT NULL, field_type text NOT NULL, required integer DEFAULT 0 NOT NULL, sort_order integer DEFAULT 0 NOT NULL, enabled integer DEFAULT 1 NOT NULL, configuration_json text, created_at text NOT NULL, updated_at text NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS application_field_definitions_key_unique ON application_field_definitions (field_key)`,
  `CREATE TABLE IF NOT EXISTS application_field_values (id text PRIMARY KEY NOT NULL, application_id text NOT NULL, field_definition_id text NOT NULL, value_text text, created_at text NOT NULL, FOREIGN KEY (application_id) REFERENCES membership_applications(id), FOREIGN KEY (field_definition_id) REFERENCES application_field_definitions(id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS application_field_values_unique ON application_field_values (application_id, field_definition_id)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY NOT NULL, window_start integer NOT NULL, count integer NOT NULL)`,
] as const;

const roles = [
  ["role-member", "member", "Қауымдастық мүшесі", "D", "Тек өзінің профилі"],
  ["role-branch-staff", "branch_staff", "Филиал қызметкері", "C", "Өз филиалының операциялары"],
  ["role-branch-director", "branch_director", "Филиал директоры", "C", "Өз филиалына жауапты"],
  ["role-department-staff", "department_staff", "Департамент қызметкері", "B", "Кәсіби міндет шегіндегі қолжетімділік"],
  ["role-department-head", "department_head", "Департамент басшысы", "B", "Департамент шегіндегі қолжетімділік"],
  ["role-vp1", "vice_president_1", "I вице-президент", "A", "Ұйымдық және институционалдық даму"],
  ["role-vp2", "vice_president_2", "II вице-президент", "B", "Математика және кәсіби даму"],
  ["role-president", "president", "Президент", "A", "Толық қолжетімділік"],
  ["role-super-admin", "super_admin", "Супер әкімші", "A", "Техникалық толық қолжетімділік"],
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
] as const;

const userSeeds = [
  ["user-president", "president@ramk.test", "person-president", "Айдана Қасымова", 1978, "astana", "Астана", "+7 700 100 00 01", "Қауымдастықтың республикалық кеңсесі", "Президент", "Математика ғылымдарының докторы", "25 жыл", "Математикалық талдау", "Ғылыми және қоғамдық жобалар жетекшісі", "Қазақстандағы математикалық қауымдастықтарды дамытуға үлес қосқан маман.", "member", "branch-astana", "2020-01-15", "role-president", "global", null],
  ["user-vp1", "vp1@ramk.test", "person-vp1", "Нұрлан Есдәулетов", 1981, "almaty", "Алматы", "+7 700 100 00 02", "Қауымдастықтың республикалық кеңсесі", "I вице-президент", "PhD", "21 жыл", "Алгебра", "Институционалдық даму жобалары", "Ұйымдық даму және аймақтық желі бойынша сарапшы.", "member", "branch-almaty", "2020-02-01", "role-vp1", "global", null],
  ["user-vp2", "vp2@ramk.test", "person-vp2", "Сәуле Төлегенқызы", 1984, "astana", "Астана", "+7 700 100 00 03", "Ұлттық зерттеу университеті", "II вице-президент", "PhD", "18 жыл", "Математикалық білім", "Әдістемелік кеңес авторы", "Математика мазмұны мен кәсіби дамуға жауапты.", "member", "branch-astana", "2021-03-12", "role-vp2", "department", "dept-content"],
  ["user-dept-head", "department@ramk.test", "person-dept-head", "Ермек Жанәбілов", 1986, "karaganda", "Қарағанды", "+7 700 100 00 04", "Қарағанды зерттеу университеті", "Департамент басшысы", "Магистр", "16 жыл", "Геометрия", "Оқу бағдарламаларының авторы", "Кәсіби даму бағдарламаларын үйлестіреді.", "member", "branch-karaganda", "2022-05-06", "role-department-head", "department", "dept-content"],
  ["user-branch-director", "branch@ramk.test", "person-branch-director", "Мадина Оразбаева", 1987, "almaty", "Алматы", "+7 700 100 00 05", "Алматы қалалық әдістемелік орталығы", "Филиал директоры", "Магистр", "15 жыл", "Ықтималдықтар теориясы", "Аймақтық семинарлар ұйымдастырушысы", "Алматы филиалының жұмысын үйлестіреді.", "member", "branch-almaty", "2022-08-20", "role-branch-director", "branch", "branch-almaty"],
  ["user-member", "member@ramk.test", "person-member", "Данияр Сәрсен", 1992, "almaty", "Алматы", "+7 700 100 00 06", "№178 лицей", "Математика мұғалімі", "Магистр", "10 жыл", "Комбинаторика", "Авторлық факультатив курсы", "Математикалық мәдениет пен дәлелдеуге негізделген оқытуға қызығады.", "member", "branch-almaty", "2024-01-18", "role-member", "global", null],
  ["user-applicant", "applicant@ramk.test", "person-applicant", "Аружан Бекмұрат", 1995, "almaty", "Алматы", "+7 700 100 00 07", "Алматы педагогикалық колледжі", "Оқытушы", "Бакалавр", "7 жыл", "Математиканы оқыту әдістемесі", "Жас мұғалімдер клубының үйлестірушісі", "Өңірлік кәсіби қауымдастыққа үлес қосуды көздейді.", "applicant", "branch-almaty", null, null, "global", null],
  ["user-reserve", "reserve@ramk.test", "person-reserve", "Темірлан Қабдолов", 1990, "east", "Өскемен", "+7 700 100 00 08", "Шығыс Қазақстан техникалық университеті", "Аға оқытушы", "Магистр", "11 жыл", "Қолданбалы математика", "Өндірістік модельдеу жобалары", "Қосымша кәсіби ақпарат күтілетін резерв үміткері.", "reserve", "branch-east", null, null, "global", null],
] as const;

let initialization: Promise<void> | null = null;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function applySchema() {
  const database = getRawDb();
  for (let index = 0; index < schemaStatements.length; index += 20) {
    await database.batch(schemaStatements.slice(index, index + 20).map((statement) => database.prepare(statement)));
  }
}

async function seed() {
  const database = getRawDb();
  const existing = await database.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  const passwordHash = await hashPassword("RamkDemo2026!");

  const branchRows = [
    ["branch-astana", "Астана қалалық филиалы", "astana", "Астана"],
    ["branch-almaty", "Алматы қалалық филиалы", "almaty", "Алматы"],
    ["branch-karaganda", "Қарағанды облыстық филиалы", "karaganda", "Қарағанды облысы"],
    ["branch-turkistan", "Түркістан облыстық филиалы", "turkistan", "Түркістан облысы"],
    ["branch-east", "Шығыс Қазақстан облыстық филиалы", "east", "Шығыс Қазақстан облысы"],
  ] as const;

  await database.batch(branchRows.map((row) => database.prepare("INSERT INTO branches (id, name, region_code, region_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)").bind(...row, now, now)));
  await database.batch(roles.map((role) => database.prepare("INSERT INTO roles (id, slug, name_kk, access_level, description, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(...role, now)));
  await database.batch(permissions.map((permission) => database.prepare("INSERT INTO permissions (id, slug, description, created_at) VALUES (?, ?, ?, ?)").bind(...permission, now)));

  const permissionMap: Record<string, string[]> = {
    member: ["permission-profile-own-read", "permission-profile-own-update"],
    branch_staff: ["permission-branch-applications-read", "permission-branch-applications-decide", "permission-branch-documents-read", "permission-branch-members-read"],
    branch_director: ["permission-branch-applications-read", "permission-branch-applications-decide", "permission-branch-documents-read", "permission-branch-members-read"],
    department_staff: ["permission-department-professional-read"],
    department_head: ["permission-department-professional-read"],
    vice_president_2: ["permission-department-professional-read"],
    vice_president_1: permissions.map((permission) => permission[0]),
    president: permissions.map((permission) => permission[0]),
    super_admin: permissions.map((permission) => permission[0]),
  };
  const rolePermissionStatements = roles.flatMap((role) =>
    permissionMap[role[1]].map((permissionId) =>
      database.prepare("INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)").bind(`rp-${role[1]}-${permissionId}`, role[0], permissionId, now),
    ),
  );
  for (let index = 0; index < rolePermissionStatements.length; index += 20) {
    await database.batch(rolePermissionStatements.slice(index, index + 20));
  }

  for (const user of userSeeds) {
    const [userId, email, personId, fullName, birthYear, regionCode, city, phone, workplace, position, education, experience, specialization, achievements, biography, status, branchId, memberSince, roleId, scopeType, scopeId] = user;
    await database.batch([
      database.prepare("INSERT INTO users (id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)").bind(userId, email, passwordHash, now, now),
      database.prepare("INSERT INTO person_profiles (id, user_id, full_name, birth_year, region_code, city_district, phone, email, workplace, position, education, professional_experience, math_specialization, achievements, biography, membership_status, membership_started_at, branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(personId, userId, fullName, birthYear, regionCode, city, phone, email, workplace, position, education, experience, specialization, achievements, biography, status, memberSince, branchId, now, now),
    ]);
    if (roleId) {
      await database.prepare("INSERT INTO user_roles (id, user_id, role_id, scope_type, scope_id, granted_by, granted_at) VALUES (?, ?, ?, ?, ?, 'user-president', ?)").bind(`assignment-${userId}`, userId, roleId, scopeType, scopeId, now).run();
    }
  }

  await database.batch([
    database.prepare("INSERT INTO branch_staff (id, branch_id, user_id, staff_type, active_from, created_at) VALUES ('staff-almaty-director', 'branch-almaty', 'user-branch-director', 'director', ?, ?)").bind(daysAgo(600), now),
    database.prepare("UPDATE branches SET director_profile_id = 'person-branch-director' WHERE id = 'branch-almaty'"),
    database.prepare("INSERT INTO membership_applications (id, person_id, branch_id, status, submitted_at, terms_version, terms_accepted_at, source) VALUES ('application-awaiting', 'person-applicant', 'branch-almaty', 'awaiting_review', ?, '2026.1', ?, 'web')").bind(daysAgo(3), daysAgo(3)),
    database.prepare("INSERT INTO membership_applications (id, person_id, branch_id, status, submitted_at, reviewed_at, reviewed_by, decision_reason, terms_version, terms_accepted_at, source) VALUES ('application-reserve', 'person-reserve', 'branch-east', 'reserve', ?, ?, 'user-president', 'Қосымша кәсіби тәжірибе туралы мәлімет қажет.', '2026.1', ?, 'qr')").bind(daysAgo(18), daysAgo(12), daysAgo(18)),
    database.prepare("INSERT INTO membership_status_history (id, person_id, application_id, previous_status, new_status, reason, visibility, changed_by, created_at) VALUES ('history-applicant', 'person-applicant', 'application-awaiting', 'registered_user', 'applicant', 'Өтініш қабылданды', 'member', NULL, ?)").bind(daysAgo(3)),
    database.prepare("INSERT INTO membership_status_history (id, person_id, application_id, previous_status, new_status, reason, visibility, changed_by, created_at) VALUES ('history-reserve', 'person-reserve', 'application-reserve', 'applicant', 'reserve', 'Қосымша кәсіби тәжірибе туралы мәлімет қажет.', 'internal', 'user-president', ?)").bind(daysAgo(12)),
    database.prepare("INSERT INTO internal_notes (id, person_id, application_id, branch_id, author_user_id, note, visibility, created_at) VALUES ('note-reserve', 'person-reserve', 'application-reserve', 'branch-east', 'user-president', 'Кәсіби портфолио толықтырылғаннан кейін қайта қарау.', 'central', ?)").bind(daysAgo(12)),
    database.prepare("INSERT INTO audit_logs (id, actor_user_id, action_type, target_entity, target_entity_id, previous_value, new_value, reason, ip_address, session_id, created_at) VALUES ('audit-reserve', 'user-president', 'application.reserve', 'membership_application', 'application-reserve', ?, ?, 'Қосымша кәсіби мәлімет қажет', '127.0.0.1', 'seed-session', ?)").bind(JSON.stringify({ status: "applicant" }), JSON.stringify({ status: "reserve" }), daysAgo(12)),
  ]);

  const fieldRows = [
    ["field-achievements", "achievements", "Кәсіби жетістіктер", "textarea", 0, 10],
    ["field-biography", "biography", "Қысқаша кәсіби өмірбаян", "textarea", 1, 20],
  ] as const;
  await database.batch(fieldRows.map((row) => database.prepare("INSERT INTO application_field_definitions (id, field_key, label_kk, field_type, required, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(...row, now, now)));
}

export async function ensureDatabase() {
  initialization ??= (async () => {
    await applySchema();
    await seed();
  })();
  return initialization;
}
