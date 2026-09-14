/* eslint-disable @next/next/no-html-link-for-pages -- vinext dashboard transitions require native navigation. */
import { RotateCcw, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getCurrentUser } from "@/lib/auth";
import { canAssignProfessionalCategories, canReviewApplications, isFullAccess } from "@/lib/authorization";
import { formatDate } from "@/lib/format";
import { listBranches, listMembers, listProfessionalCategories } from "@/db/queries";

function optionalAge(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function ageOf(birthDate: string | null, birthYear: number | null) {
  if (!birthDate) return birthYear ? `≈ ${new Date().getUTCFullYear() - birthYear}` : "—";
  const born = new Date(birthDate);
  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age -= 1;
  return String(age);
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{
  success?: string; error?: string; categoryId?: string; branchId?: string; membershipStatus?: string;
  q?: string; workplace?: string; position?: string; cityDistrict?: string; minimumAge?: string; ageUnder?: string;
}> }) {
  const user = (await getCurrentUser())!;
  if (!canReviewApplications(user)) notFound();
  const state = await searchParams;
  const filters = {
    categoryId: state.categoryId || undefined,
    branchId: state.branchId || undefined,
    query: state.q?.trim() || undefined,
    workplace: state.workplace?.trim() || undefined,
    position: state.position?.trim() || undefined,
    cityDistrict: state.cityDistrict?.trim() || undefined,
    minimumAge: optionalAge(state.minimumAge, 18, 100),
    ageUnder: optionalAge(state.ageUnder, 19, 101),
  };
  const [members, branches, categories] = await Promise.all([
    listMembers(user, filters),
    listBranches(user),
    listProfessionalCategories(),
  ]);
  const full = isFullAccess(user);
  const canAssignCategories = canAssignProfessionalCategories(user);

  return <main className="dashboard-content">
    <div className="dash-page-heading"><div><p>Жалпы фильтрлі іздеу</p><h1>Адамдар мен кәсіби профильдер</h1></div><span className="record-count">{members.length} профиль</span></div>
    {state.success && <div className="dash-alert success">{state.success === "erased" ? "Аккаунт, жеке деректер және файлдар біржола өшірілді." : "Өзгеріс сақталды. Бұрынғы мәндер аудит тарихында сақталды."}</div>}
    {state.error && <div className="dash-alert error">{state.error === "confirmation" ? "Өшіруді растау үшін ӨШІРУ сөзін дәл жазыңыз." : state.error === "self" ? "Өз аккаунтыңызды осы жерден өшіруге болмайды." : "Өзгерісті сақтау мүмкін болмады. Қате сервер журналында тіркелді."}</div>}
    <form className="member-search" method="get">
      <div className="member-search-intro"><span><Search size={18} /></span><div><strong>Қажетті адамды бірнеше белгімен табыңыз</strong><small>Мысалы: жасы 35-ке толмаған, мектепте істейтін математика мұғалімі.</small></div></div>
      <label className="member-search-wide">Жалпы сөз<input name="q" defaultValue={filters.query ?? ""} maxLength={120} placeholder="Аты-жөні, мамандануы немесе оқу орны" /></label>
      <label>Мәртебе<select disabled defaultValue="member"><option value="member">Мақұлданған мүше</option></select></label>
      <label>Өңір<select name="branchId" defaultValue={filters.branchId ?? ""}><option value="">Барлық рұқсат етілген өңір</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select></label>
      <label>Кәсіби санат<select name="categoryId" defaultValue={filters.categoryId ?? ""}><option value="">Барлық санат</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}{category.status === "inactive" ? " · белсенді емес" : ""}</option>)}</select></label>
      <label>Жасы кемінде<input type="number" name="minimumAge" min={18} max={100} defaultValue={filters.minimumAge ?? ""} placeholder="мысалы, 25" /></label>
      <label>Жасы толмаған<input type="number" name="ageUnder" min={19} max={101} defaultValue={filters.ageUnder ?? ""} placeholder="мысалы, 35" /></label>
      <label>Жұмыс орны<input name="workplace" defaultValue={filters.workplace ?? ""} maxLength={120} placeholder="мысалы, мектеп" /></label>
      <label>Лауазымы<input name="position" defaultValue={filters.position ?? ""} maxLength={120} placeholder="математика мұғалімі" /></label>
      <label>Қала / аудан<input name="cityDistrict" defaultValue={filters.cityDistrict ?? ""} maxLength={120} placeholder="Алматы" /></label>
      <div className="member-search-actions"><button type="submit"><Search size={15} /> Іздеу</button><a href="/dashboard/members"><RotateCcw size={14} /> Тазарту</a></div>
    </form>
    <section className="panel"><div className="table-wrap"><table className="data-table member-table"><thead><tr><th>Аты-жөні</th><th>Жасы / елді мекені</th><th>Жұмыс орны / қызметі</th><th>Филиал</th><th>Мүшелік</th><th>Кәсіби санаттар</th>{(full || canAssignCategories) && <th>Әкімшілік өзгеріс</th>}</tr></thead><tbody>{members.map((member) => {
      const selectedCategoryIds = new Set(member.professionalCategories.map((category) => category.id));
      const age = ageOf(member.birthDate, member.birthYear);
      return <tr key={member.id}><td><a className="table-person-link" href={`/dashboard/members/${member.id}`}><strong>{member.fullName}</strong><small>{member.email}</small></a></td><td><strong>{age === "—" ? age : `${age} жас`}</strong><small>{member.cityDistrict}</small></td><td><span>{member.workplace ?? "—"}</span><small>{member.position ?? member.mathSpecialization ?? member.phone}</small></td><td>{member.branchName ?? "—"}</td><td><StatusBadge status={member.membershipStatus} /><small>{formatDate(member.membershipStartedAt)}</small></td><td><div className="category-chips">{member.professionalCategories.length ? member.professionalCategories.map((category) => <span className={category.status === "inactive" ? "inactive" : ""} key={category.id}>{category.name}</span>) : <small>Тағайындалмаған</small>}</div></td>{(full || canAssignCategories) && <td><div className="member-admin-actions">
        {full && <details className="row-editor"><summary>Мәртебе / филиал</summary><form action={`/api/members/${member.id}`} method="post"><select name="membershipStatus" defaultValue={member.membershipStatus}><option value="registered_user">Тіркелген</option><option value="applicant">Үміткер</option><option value="reserve">Резерв</option><option value="member">Мүше</option><option value="suspended">Тоқтатылған</option><option value="former_member">Бұрынғы мүше</option></select><select name="branchId" defaultValue={member.branchId ?? ""}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select><input name="reason" required minLength={5} placeholder="Өзгеріс себебі" /><button type="submit">Сақтау</button></form></details>}
        {canAssignCategories && <details className="row-editor category-assignment-editor"><summary>Кәсіби санаттар</summary><form action={`/api/members/${member.id}/professional-categories`} method="post"><fieldset><legend>Бірнеше санатты таңдауға болады</legend>{categories.map((category) => <label key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={selectedCategoryIds.has(category.id)} disabled={category.status === "inactive" && !selectedCategoryIds.has(category.id)} /><span>{category.name}{category.status === "inactive" ? " · белсенді емес" : ""}</span></label>)}</fieldset><input name="reason" maxLength={500} placeholder="Өзгеріс себебі" /><button type="submit">Санаттарды сақтау</button></form></details>}
        {full && member.userId !== user.id && <details className="row-editor candidate-erasure-editor"><summary>Біржола өшіру</summary><form action={`/api/members/${member.id}/erase`} method="post"><strong>Бұл әрекет қайтарылмайды</strong><small>Мәртебесіне қарамастан аккаунт пен жеке деректер жойылады. Тарихи жазбалар аноним түрде қалады. Растау үшін ӨШІРУ деп жазыңыз.</small><input name="confirmation" required autoComplete="off" placeholder="ӨШІРУ" /><input name="reason" required minLength={5} maxLength={500} placeholder="Өшіру себебі" /><button type="submit">Біржола өшіру</button></form></details>}
      </div></td>}</tr>;
    })}</tbody></table>{members.length === 0 && <div className="empty-state"><h2>Профиль табылмады</h2><p>Таңдалған сүзгі мен рұқсат аумағында мүше жоқ.</p></div>}</div></section>
  </main>;
}
