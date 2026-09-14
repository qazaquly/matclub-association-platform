import { Archive, BookOpenCheck, Building2, FolderTree, ShieldCheck, UserCog } from "lucide-react";
import { notFound } from "next/navigation";
import { listBranches, listUsersAndRoles } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canManageRoles } from "@/lib/authorization";
import { statusLabel } from "@/lib/format";

type DepartmentRow = Awaited<ReturnType<typeof listUsersAndRoles>>["departments"][number];

function orderedDepartments(departments: DepartmentRow[]) {
  const byId = new Map(departments.map((department) => [department.id, department]));
  const pathFor = (department: DepartmentRow) => {
    const path = [department.nameKk];
    const seen = new Set([department.id]);
    let parentId = department.parentId;
    while (parentId && byId.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId)!;
      path.unshift(parent.nameKk);
      parentId = parent.parentId;
    }
    return path;
  };
  return departments
    .map((department) => ({ department, path: pathFor(department) }))
    .sort((left, right) => left.path.join(" / ").localeCompare(right.path.join(" / "), "kk"));
}

function stateMessage(state: { success?: string; error?: string }) {
  if (state.success === "structure") return { kind: "success", text: "Құрылымдық бөлім сақталды және аудитке тіркелді." };
  if (state.success) return { kind: "success", text: "Өзгеріс сақталды және аудитке тіркелді." };
  const errors: Record<string, string> = {
    "structure-validation": "Бөлімнің атауын, түрін және өзгеріс себебін толық толтырыңыз.",
    "structure-duplicate": "Осы деңгейде дәл осындай атауы бар белсенді бөлім бар.",
    "structure-parent": "Таңдалған жоғары тұрған бөлім табылмады немесе архивтелген.",
    "structure-cycle": "Бөлімді өзіне немесе өзінің төменгі бөліміне бағындыруға болмайды.",
    "structure-in-use": "Алдымен бөлімнің төменгі бөлімдерін, мүшелерін және рөлдік тағайындауларын ауыстырыңыз немесе аяқтаңыз.",
    "structure-no-change": "Бөлім деректерінде сақталатын өзгеріс жоқ.",
    scope: "Рөлге сәйкес филиалды немесе құрылымдық бөлімді таңдаңыз.",
    duplicate: "Бұл рөл мен аумақ пайдаланушыға бұрыннан берілген.",
    self: "Өзіңіздің қорғалған жаһандық рөліңізді осы операциямен қайтаруға болмайды.",
    "last-admin": "Жүйеде кемінде бір толық жаһандық әкімші қалуы керек.",
  };
  if (state.error) return { kind: "error", text: errors[state.error] ?? "Өзгерісті сақтау мүмкін болмады. Аумақ пен құқықтарды тексеріңіз." };
  return null;
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const actor = (await getCurrentUser())!;
  if (!canManageRoles(actor)) notFound();
  const [access, branches, state] = await Promise.all([listUsersAndRoles(), listBranches(), searchParams]);
  const { users, assignments, roles, departments, departmentAssignments } = access;
  const ordered = orderedDepartments(departments);
  const message = stateMessage(state);
  const scopeNames = new Map([
    ...branches.map((branch) => [branch.id, branch.regionName] as const),
    ...departments.map((department) => [department.id, department.nameKk] as const),
  ]);

  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Серверлік авторизация</p><h1>Рөлдер мен құқықтар</h1></div><span className="immutable-pill"><ShieldCheck size={15} /> A деңгейі</span></div>
    {message && <div className={`dash-alert ${message.kind}`}>{message.text}</div>}
    <section className="access-overview">
      <div><span>A</span><strong>Толық</strong><small>Президент, II вице-президент</small></div>
      <div><span>B</span><strong>Кәсіби</strong><small>I вице-президент — республика; басшы — өз бөлімі</small></div>
      <div><span>C</span><strong>Филиал</strong><small>Тек өз өңірі</small></div>
      <div><span>D</span><strong>Мүше</strong><small>Тек өз профилі</small></div>
    </section>

    <section className="panel structure-panel">
      <div className="panel-heading"><div><span>Басқарылатын иерархия</span><h2>Ұйымдық құрылым</h2></div><FolderTree size={21} /></div>
      <p className="panel-intro">Президент пен II вице-президент бөлімдерді код өзгертпей жасайды, өңдейді және архивтейді. Архивтеу алдында белсенді мүшелер мен рөлдер басқа бөлімге ауыстырылуы тиіс.</p>
      <div className="structure-management-grid">
        <form className="role-form structure-create-form" action="/api/access/structure" method="post">
          <input type="hidden" name="action" value="create" />
          <label>Бөлім атауы<input name="nameKk" required minLength={2} maxLength={160} placeholder="Құрылымдық бөлімнің ресми атауы" /></label>
          <label>Бөлім түрі<input name="unitType" required minLength={2} maxLength={80} placeholder="Департамент, бөлім немесе басқа түр" /></label>
          <label>Жоғары тұрған бөлім<select name="parentId" defaultValue=""><option value="">Жоғарғы деңгей</option>{ordered.map(({ department, path }) => <option key={department.id} value={department.id}>{path.join(" / ")}</option>)}</select></label>
          <label>Мақсаты мен өкілеті<textarea name="description" rows={3} maxLength={1500} placeholder="Бұл бөлімнің жауапкершілік шекарасы" /></label>
          <label>Құру себебі<input name="reason" required minLength={5} maxLength={500} placeholder="Аудит журналына жазылатын негіздеме" /></label>
          <button className="button button-secondary" type="submit"><Building2 size={16} /> Жаңа бөлім ашу</button>
        </form>
        <div className="structure-list">
          {ordered.map(({ department, path }) => {
            const inUse = department.activeChildCount + department.activeMemberCount + department.activeRoleCount > 0;
            return <details className="structure-unit" key={department.id}>
              <summary>
                <span className="structure-depth" style={{ "--unit-depth": Math.max(0, path.length - 1) } as React.CSSProperties}><Building2 size={17} /></span>
                <span><strong>{department.nameKk}</strong><small>{department.unitType}{department.parentName ? ` · ${department.parentName} құрамында` : " · жоғарғы деңгей"}</small></span>
                <span className="structure-counts">{department.activeMemberCount} адам · {department.activeRoleCount} рөл</span>
              </summary>
              <div className="structure-unit-editor">
                <form className="role-form" action="/api/access/structure" method="post">
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="departmentId" value={department.id} />
                  <label>Бөлім атауы<input name="nameKk" required minLength={2} maxLength={160} defaultValue={department.nameKk} /></label>
                  <label>Бөлім түрі<input name="unitType" required minLength={2} maxLength={80} defaultValue={department.unitType} /></label>
                  <label>Жоғары тұрған бөлім<select name="parentId" defaultValue={department.parentId ?? ""}><option value="">Жоғарғы деңгей</option>{ordered.filter(({ department: option }) => option.id !== department.id).map(({ department: option, path: optionPath }) => <option key={option.id} value={option.id}>{optionPath.join(" / ")}</option>)}</select></label>
                  <label>Мақсаты мен өкілеті<textarea name="description" rows={3} maxLength={1500} defaultValue={department.description ?? ""} /></label>
                  <label>Өзгеріс себебі<input name="reason" required minLength={5} maxLength={500} placeholder="Аудит журналына жазылатын негіздеме" /></label>
                  <button className="button button-secondary" type="submit">Өзгерістерді сақтау</button>
                </form>
                <form className="archive-unit-form" action="/api/access/structure" method="post">
                  <input type="hidden" name="action" value="archive" />
                  <input type="hidden" name="departmentId" value={department.id} />
                  <label>Архивтеу себебі<input name="reason" required minLength={5} maxLength={500} disabled={inUse} placeholder={inUse ? "Алдымен белсенді байланыстарды аяқтаңыз" : "Аудит журналына жазылатын негіздеме"} /></label>
                  <button className="button button-danger" type="submit" disabled={inUse} title={inUse ? "Бөлімде белсенді байланыстар бар" : "Бөлімді архивтеу"}><Archive size={15} /> Архивтеу</button>
                </form>
              </div>
            </details>;
          })}
          {ordered.length === 0 && <div className="empty-state"><h3>Құрылымдық бөлім жоқ</h3><p>Алғашқы бөлімді сол жақтағы нысан арқылы ашыңыз.</p></div>}
        </div>
      </div>
    </section>

    <div className="access-grid">
      <section className="panel">
        <div className="panel-heading"><div><span>Тағайындау</span><h2>Жаңа рөл беру</h2></div><UserCog size={20} /></div>
        <form className="role-form" action="/api/access/roles" method="post">
          <input type="hidden" name="action" value="grant" />
          <label>Пайдаланушы<select name="userId" required>{users.map((user) => <option value={user.id} key={user.id}>{user.fullName} · {user.email}</option>)}</select></label>
          <label>Рөл<select name="roleId" required>{roles.map((role) => <option value={role.id} key={role.id}>{role.accessLevel} · {role.nameKk}</option>)}</select></label>
          <label>Жауапкершілік аумағы<select name="scopeId" defaultValue=""><option value="">Жаһандық немесе қолданылмайды</option><optgroup label="Филиалдар">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.regionName}</option>)}</optgroup><optgroup label="Құрылымдық бөлімдер">{ordered.map(({ department, path }) => <option key={department.id} value={department.id}>{path.join(" / ")}</option>)}</optgroup></select></label>
          <label>Өзгеріс себебі<input name="reason" type="text" maxLength={500} placeholder="Қажет болған жағдайда негіздеме" /></label>
          <button className="button button-secondary" type="submit">Рөл беру</button>
        </form>
      </section>
      <section className="panel wide">
        <div className="panel-heading"><div><span>Белсенді құқықтар</span><h2>Пайдаланушылар</h2></div><span>{assignments.length} тағайындау</span></div>
        <div className="assignment-list">{users.map((user) => {
          const userAssignments = assignments.filter((assignment) => assignment.userId === user.id);
          return <article key={user.id}><div><strong>{user.fullName}</strong><small>{user.email} · {statusLabel(user.membershipStatus)}</small></div><div className="role-chips">{userAssignments.length ? userAssignments.map((assignment) => <form key={assignment.id} action="/api/access/roles" method="post"><input type="hidden" name="action" value="revoke" /><input type="hidden" name="assignmentId" value={assignment.id} /><button title="Рөлді қайтару" type="submit">{assignment.nameKk}{assignment.scopeId && scopeNames.get(assignment.scopeId) ? <small>{scopeNames.get(assignment.scopeId)}</small> : null}<span>×</span></button></form>) : <span className="no-role">Жүйелік рөл жоқ</span>}</div></article>;
        })}</div>
      </section>
    </div>

    <div className="access-grid">
      <section className="panel">
        <div className="panel-heading"><div><span>Кәсіби байланыс</span><h2>Құрылымдық бөлімге қосу</h2></div><BookOpenCheck size={20} /></div>
        <form className="role-form" action="/api/access/departments" method="post">
          <input type="hidden" name="action" value="grant" />
          <label>Адам<select name="personId" required>{users.map((user) => <option value={user.personId} key={user.personId}>{user.fullName}</option>)}</select></label>
          <label>Құрылымдық бөлім<select name="departmentId" required>{ordered.map(({ department, path }) => <option value={department.id} key={department.id}>{path.join(" / ")}</option>)}</select></label>
          <label>Өзгеріс себебі<input name="reason" type="text" maxLength={500} placeholder="Қажет болған жағдайда негіздеме" /></label>
          <button className="button button-secondary" type="submit">Тағайындау</button>
        </form>
      </section>
      <section className="panel wide">
        <div className="panel-heading"><div><span>Ішкі басқару</span><h2>Құрылымдық бөлім мүшелері</h2></div><span>{departmentAssignments.length} тағайындау</span></div>
        <div className="assignment-list">{users.map((user) => {
          const personAssignments = departmentAssignments.filter((assignment) => assignment.personId === user.personId);
          if (!personAssignments.length) return null;
          return <article key={user.personId}><div><strong>{user.fullName}</strong><small>{user.email}</small></div><div className="role-chips">{personAssignments.map((assignment) => <form key={assignment.id} action="/api/access/departments" method="post"><input type="hidden" name="action" value="revoke" /><input type="hidden" name="assignmentId" value={assignment.id} /><button title="Бөлімнен шығару" type="submit">{assignment.departmentName}<span>×</span></button></form>)}</div></article>;
        })}</div>
      </section>
    </div>
  </main>;
}
