import { CalendarCheck, Eye, EyeOff, PencilLine, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/app/components/StatusBadge";
import { getOwnProfile } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { educationLevels } from "@/lib/membership-application";
import { attendanceStatusLabel } from "@/lib/event-participation";
import { ProfileDocuments } from "./ProfileDocuments";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const user = (await getCurrentUser())!;
  const [profile, state] = await Promise.all([getOwnProfile(user), searchParams]);
  if (!profile) return null;
  const surname = String(profile.surname ?? "");
  const givenName = String(profile.given_name ?? profile.full_name ?? "");
  const patronymic = String(profile.patronymic ?? "");
  const errorMessage = state.error === "fullName"
    ? "Аты-жөніңізді толық әрі дұрыс енгізіңіз."
    : state.error
      ? "Деректерді жаңарту мүмкін болмады."
      : null;

  return <main className="dashboard-content">
    <div className="dash-page-heading">
      <div><p>Бір адам · бір профиль</p><h1>Менің профилім</h1></div>
      <StatusBadge status={user.membershipStatus} />
    </div>
    {state.success && <div className="dash-alert success">Профиль жаңартылды. Өзгеріс аудит журналында сақталды.</div>}
    {errorMessage && <div className="dash-alert error">{errorMessage}</div>}
    <div className="profile-layout">
      <div className="profile-main-column">
      <section className="panel">
        <div className="panel-heading">
          <div><span><PencilLine size={15} /> 1-қабат</span><h2>Өзгертуге болатын деректер</h2></div>
          <span className="visibility-label"><Eye size={15} /> Сізге көрінеді</span>
        </div>
        <form className="profile-form" action="/api/profile" method="post">
          <div className="form-grid">
            <label>Тегі<input name="surname" maxLength={80} autoComplete="family-name" defaultValue={surname} /></label>
            <label>Аты<input name="givenName" required maxLength={80} autoComplete="given-name" defaultValue={givenName} aria-invalid={state.error === "fullName"} /></label>
            <label>Әкесінің аты<input name="patronymic" maxLength={80} autoComplete="additional-name" defaultValue={patronymic} /></label>
            <label>Телефон<input name="phone" required defaultValue={String(profile.phone ?? "")} /></label>
            <label>Email (логин)<input type="email" value={user.email} readOnly aria-readonly="true" /></label>
            <label>Жұмыс немесе оқу орны<input name="workplace" defaultValue={String(profile.workplace ?? "")} /></label>
            <label>Лауазымы немесе мәртебесі<input name="position" defaultValue={String(profile.position ?? "")} /></label>
            <label>Білім деңгейі<select name="educationLevelCode" defaultValue={String(profile.education_level_code ?? "")}><option value="">Көрсетілмеген</option>{educationLevels.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label>
            <label>Оқу орны<input name="educationInstitution" defaultValue={String(profile.education_institution ?? "")} /></label>
            <label className="span-2">Мамандығы / білім беру бағдарламасы<input name="educationProgram" defaultValue={String(profile.education_program ?? "")} /></label>
            <label className="span-2">Математикалық мамандану<textarea name="mathSpecialization" rows={2} defaultValue={String(profile.math_specialization ?? "")} /></label>
            <label className="span-2">Кәсіби жетістіктер<textarea name="achievements" rows={3} defaultValue={String(profile.achievements ?? "")} /></label>
          </div>
          <button className="button button-primary" type="submit">Өзгерістерді сақтау</button>
        </form>
      </section>
      <section className="panel profile-events"><div className="panel-heading"><div><span>Іс-шаралар</span><h2><CalendarCheck size={18} /> Менің тіркелулерім</h2></div></div><div className="profile-event-list">{profile.eventRegistrations.map((registration) => <a href={`/events/${registration.eventSlug}`} key={registration.id}><div><strong>{registration.eventTitle}</strong><span>{formatDate(registration.startAt, true)}</span></div><small>{attendanceStatusLabel(registration.attendanceStatus)}{registration.seat ? ` · Орын: ${registration.seat}` : ""}</small></a>)}{profile.eventRegistrations.length === 0 && <p className="muted">Белсенді тіркелу жоқ.</p>}</div></section>
      <section className="panel profile-events"><div className="panel-heading"><div><span>Расталған тарих</span><h2>Бірлестіктегі қызметім</h2></div></div><div className="profile-event-list">{profile.activities.map((activity) => activity.eventSlug ? <a href={`/events/${activity.eventSlug}`} key={activity.id}><div><strong>{activity.title}</strong><span>{formatDate(activity.occurredAt, true)}</span></div><small>Іс-шараға нақты қатысты</small></a> : <div className="profile-activity-item" key={activity.id}><div><strong>{activity.title}</strong><span>{formatDate(activity.occurredAt, true)}</span></div><small>{activity.description ?? "Жобаға қатысты"}</small></div>)}{profile.activities.length === 0 && <p className="muted">Расталған қызмет тарихы әлі жоқ.</p>}</div></section>
      <ProfileDocuments initialDocuments={profile.documents} />
      </div>
      <aside>
        <section className="profile-official">
          <div><ShieldCheck size={21} /><span>2-қабат</span></div>
          <h2>Ресми деректер</h2>
          <p>Бұл ақпарат сізге көрінеді, бірақ тек уәкілетті әкімшілік арқылы өзгереді.</p>
          <dl>
            <div><dt>Мүшелік мәртебесі</dt><dd><StatusBadge status={String(profile.membership_status)} /></dd></div>
            <div><dt>Кәсіби санаттар</dt><dd><div className="category-chips profile-category-chips">{profile.professionalCategories.length ? profile.professionalCategories.map((category) => <span className={category.status === "inactive" ? "inactive" : ""} key={category.id}>{category.name}</span>) : "Тағайындалмаған"}</div></dd></div>
            <div><dt>Мүшелік басталған күн</dt><dd>{formatDate(String(profile.membership_started_at ?? ""))}</dd></div>
            <div><dt>Филиал</dt><dd>{String(profile.branchName ?? "—")}</dd></div>
            <div><dt>Туған күні</dt><dd>{profile.birth_date ? formatDate(String(profile.birth_date)) : String(profile.birth_year ?? "—")}</dd></div>
          </dl>
        </section>
        <section className="profile-internal">
          <EyeOff size={21} />
          <div><span>3-қабат</span><h2>Ішкі деректер қорғалған</h2><p>Қызметтік жазбалар, әкімшілік бағалар және аудит ақпараты мүше профилінде көрсетілмейді.</p></div>
        </section>
      </aside>
    </div>
  </main>;
}
