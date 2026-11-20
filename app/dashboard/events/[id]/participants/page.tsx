import { PersonSelect } from "@/app/components/PersonSelect";
import { isPublicEventStatus } from "@/lib/events";
import { ArrowLeft, DoorOpen, Monitor, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { EventSeatingEditor } from "@/app/components/EventSeatingEditor";
import { getEventParticipationBundle, listEligibleEventMembers } from "@/db/event-participation";
import { getCurrentUser } from "@/lib/auth";
import {
  canAccessManagedEvent, canManageEventAttendance, canManageEventParticipants, canManageEventSeating, canViewEventParticipants,
} from "@/lib/authorization";
import { attendanceStatusLabel, participantTypeLabel, registrationStatusLabel } from "@/lib/event-participation";

function stateMessage(state: { success?: string; error?: string }) {
  if (state.success) return { kind: "success", text: "Өзгеріс сақталды және аудит журналына тіркелді." };
  if (state.error === "full") return { kind: "error", text: "Қатысушылар орны толды." };
  if (state.error === "seat-taken") return { kind: "error", text: "Бұл орын басқа қатысушыға берілген." };
  if (state.error === "invalid-seat") return { kind: "error", text: "Таңдалған орын сызбаға сәйкес келмейді." };
  if (state.error === "seats-in-use") return { kind: "error", text: "Орын сызбасын ауыстыру үшін қолданыстағы орындарды босатуға келісім белгісін қойыңыз." };
  if (state.error) return { kind: "error", text: "Өзгеріс сақталмады. Енгізілген деректерді тексеріңіз." };
  return null;
}

export default async function EventParticipantsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string; q?: string }> }) {
  const actor = (await getCurrentUser())!;
  const { id } = await params;
  const [bundle, state] = await Promise.all([getEventParticipationBundle(id), searchParams]);
  if (!bundle.event) notFound();
  const event = bundle.event;
  if (!canAccessManagedEvent(actor, event) || !canViewEventParticipants(actor)) notFound();
  const members = canManageEventParticipants(actor) ? await listEligibleEventMembers(actor, event) : [];
  const message = stateMessage(state);
  const active = bundle.registrations.filter((item) => item.registrationStatus === "REGISTERED");
  const present = active.filter((item) => item.attendance?.status === "PRESENT").length;
  const cancelled = bundle.registrations.length - active.length;
  const needle = state.q?.trim().toLocaleLowerCase("kk-KZ") ?? "";
  const matching = bundle.registrations.filter((row) => [row.fullName, row.organization, row.regionName, row.guestGroup].join(" ").toLocaleLowerCase("kk-KZ").includes(needle));
  const occupiedSeats = active.flatMap((registration) => registration.seatingUnitId && registration.seatNumber ? [{
    registrationId: registration.id,
    fullName: registration.fullName,
    seatingUnitId: registration.seatingUnitId,
    seatNumber: registration.seatNumber,
    present: registration.attendance?.status === "PRESENT",
  }] : []);
  const occupiedSeatKeys = new Map(occupiedSeats.map((seat) => [`${seat.seatingUnitId}:${seat.seatNumber}`, seat.registrationId]));

  return <main className="dashboard-content">
    <a className="back-link" href={`/dashboard/events/${id}`}><ArrowLeft size={15} /> Іс-шара</a>
    <div className="dash-page-heading"><div><p>Қатысушыларды басқару</p><h1>{bundle.event.title}: қатысушылар</h1></div><div className="heading-actions">{canManageEventAttendance(actor) && <a className="button" href={`/dashboard/events/${id}/reception`}><DoorOpen size={16} /> Келгендерді белгілеу</a>}{bundle.event.publishedAt && !bundle.event.archivedAt && isPublicEventStatus(bundle.event.status) && <a className="button" href={`/events/${bundle.event.slug}/screen`} target="_blank" rel="noreferrer"><Monitor size={16} /> Экран</a>}</div></div>
    {message && <div className={`dash-alert ${message.kind}`}>{message.text}</div>}
    <nav className="task-links" aria-label="Қатысушылармен жұмыс"><a href="#roster">Тізім</a>{canManageEventParticipants(actor) && <a href="#add-participant">Қатысушы қосу</a>}{canManageEventSeating(actor) && <a href="#seating">Орындарды реттеу</a>}</nav>
    <section className="participation-stats"><article><span>Тіркелген</span><strong>{active.length}</strong></article><article><span>Қатысты</span><strong>{present}</strong></article><article><span>Бас тартқан</span><strong>{cancelled}</strong></article><article><span>Шек</span><strong>{bundle.event.participantLimit ?? "∞"}</strong></article></section>

    <section id="roster" className="panel participant-table-panel"><div className="panel-heading"><div><span>Жабық тізім</span><h2><Users size={18} /> Барлық тіркелу</h2></div></div><form className="event-filter" method="get" action={`/dashboard/events/${id}/participants#roster`}><label>Аты-жөні, ұйымы немесе өңірі<input name="q" type="search" defaultValue={state.q} /></label><button className="button">Іздеу</button>{state.q && <a href={`/dashboard/events/${id}/participants#roster`}>Тазарту</a>}</form><div className="table-wrap"><table className="data-table participant-table"><thead><tr><th>Қатысушы</th><th>Түрі</th><th>Тіркелу</th><th>Қатысу</th><th>Орын</th><th>Әрекет</th></tr></thead><tbody>{matching.map((registration) => <tr key={registration.id} className={registration.registrationStatus === "CANCELLED" ? "muted-row" : ""}><td><strong>{registration.fullName}</strong><small>{registration.organization ?? registration.person?.branch?.regionName ?? registration.regionName ?? "—"}</small></td><td>{participantTypeLabel(registration.participantType)}</td><td>{registrationStatusLabel(registration.registrationStatus)}</td><td><span className={`attendance-pill ${(registration.attendance?.status ?? "PENDING").toLowerCase()}`}>{attendanceStatusLabel(registration.attendance?.status ?? "PENDING")}</span>{registration.registrationStatus === "REGISTERED" && canManageEventAttendance(actor) && <form action={`/api/events/${id}/participants`} method="post" className="inline-actions"><input type="hidden" name="registrationId" value={registration.id} /><button name="status" value="PRESENT" type="submit">Қатысты</button><button name="status" value="ABSENT" type="submit">Қатыспады</button><button name="status" value="PENDING" type="submit">Тазалау</button><input type="hidden" name="action" value="attendance" /></form>}</td><td>{registration.seatingUnit ? <strong>{event.seatingType === "TABLES" ? `${registration.seatingUnit.label}-үстел · ${registration.seatNumber}-орын` : `${registration.seatingUnit.label} қатары · ${registration.seatNumber}-орын`}</strong> : "—"}{registration.registrationStatus === "REGISTERED" && canManageEventSeating(actor) && bundle.seatingUnits.length > 0 && <form action={`/api/events/${id}/participants`} method="post" className="seat-form seat-picker-form"><input type="hidden" name="registrationId" value={registration.id} /><select aria-label={`${registration.fullName} орнын таңдау`} name="seatKey" defaultValue={registration.seatingUnitId && registration.seatNumber ? `${registration.seatingUnitId}:${registration.seatNumber}` : ""}><option value="">Орын бекітілмесін</option>{bundle.seatingUnits.map((unit) => <optgroup label={event.seatingType === "TABLES" ? `${unit.label}-үстел` : `${unit.label} қатары`} key={unit.id}>{Array.from({ length: unit.seatCount }, (_, index) => { const seatNumber = index + 1; const seatKey = `${unit.id}:${seatNumber}`; const occupantId = occupiedSeatKeys.get(seatKey); return <option disabled={Boolean(occupantId && occupantId !== registration.id)} value={seatKey} key={seatKey}>{seatNumber}-орын{occupantId && occupantId !== registration.id ? " · бос емес" : " · бос"}</option>; })}</optgroup>)}</select><button name="action" value="assign_seat" type="submit">Сақтау</button></form>}</td><td>{canManageEventParticipants(actor) && (registration.registrationStatus === "REGISTERED" ? <form action={`/api/events/${id}/participants`} method="post" className="cancel-form"><input type="hidden" name="registrationId" value={registration.id} /><input aria-label="Өзгеріс себебі" name="reason" required minLength={1} maxLength={1000} placeholder="Себебі" /><button className="text-danger" name="action" value="cancel" type="submit">Тоқтату</button></form> : <form action={`/api/events/${id}/participants`} method="post"><input type="hidden" name="registrationId" value={registration.id} /><button name="action" value="restore" type="submit">Қайтару</button></form>)}</td></tr>)}</tbody></table></div>{matching.length === 0 && <p className="empty-content">{state.q ? "Қатысушы табылмады." : "Тізімде қатысушы жоқ."}</p>}</section>
    {canManageEventParticipants(actor) && <section id="add-participant" className="participant-add-grid">
      <div className="panel"><div className="panel-heading"><div><span>Ішкі профиль</span><h2>Мүшені қосу</h2></div></div><form action={`/api/events/${id}/participants`} method="post" className="stack-form"><PersonSelect people={members} name="personId" label="Мүше" placeholder="Мүшені таңдаңыз" required /><button className="button button-primary" name="action" value="add_member" type="submit">Мүшені қосу</button></form></div>
      <div className="panel"><div className="panel-heading"><div><span>Жабық әкімшілік тіркелу</span><h2>Қонақты қосу</h2></div></div><form action={`/api/events/${id}/participants`} method="post" className="stack-form"><input aria-label="Аты-жөні" name="fullName" required maxLength={250} placeholder="Аты-жөні" /><input aria-label="Ұйым" name="organization" maxLength={500} placeholder="Ұйымы" /><div className="compact-fields"><input aria-label="Телефон" name="phone" maxLength={80} placeholder="Телефон" /><input aria-label="Электрондық пошта" name="email" type="email" maxLength={320} placeholder="Email" /></div><div className="compact-fields"><input aria-label="Өңір" name="regionName" maxLength={180} placeholder="Өңір" /><input aria-label="Қонақ тобы" name="guestGroup" maxLength={180} placeholder="Топ / делегация" /></div><button className="button button-primary" name="action" value="add_guest" type="submit">Қонақты қосу</button></form></div>
    </section>}

    {canManageEventSeating(actor) && <div id="seating"><EventSeatingEditor eventId={id} initialType={bundle.event.seatingType} initialUnits={bundle.seatingUnits.map((unit) => ({ id: unit.id, label: unit.label, seatCount: unit.seatCount }))} occupiedSeats={occupiedSeats} /></div>}


  </main>;
}
