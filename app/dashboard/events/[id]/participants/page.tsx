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

export default async function EventParticipantsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
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
    <div className="dash-page-heading"><div><p>Phase 2.3</p><h1>{bundle.event.title}: қатысушылар</h1></div><div className="heading-actions"><a className="button" href={`/dashboard/events/${id}/reception`}><DoorOpen size={16} /> Reception</a><a className="button" href={`/events/${bundle.event.slug}/screen`} target="_blank" rel="noreferrer"><Monitor size={16} /> Экран</a></div></div>
    {message && <div className={`dash-alert ${message.kind}`}>{message.text}</div>}
    <section className="participation-stats"><article><span>Тіркелген</span><strong>{active.length}</strong></article><article><span>Қатысты</span><strong>{present}</strong></article><article><span>Бас тартқан</span><strong>{cancelled}</strong></article><article><span>Шек</span><strong>{bundle.event.participantLimit ?? "∞"}</strong></article></section>

    {canManageEventParticipants(actor) && <section className="participant-add-grid">
      <div className="panel"><div className="panel-heading"><div><span>Ішкі профиль</span><h2>Мүшені қосу</h2></div></div><form action={`/api/events/${id}/participants`} method="post" className="stack-form"><select name="personId" required defaultValue=""><option value="" disabled>Мүшені таңдаңыз</option>{members.map((member) => <option value={member.id} key={member.id}>{member.fullName}{member.branch ? ` · ${member.branch.regionName}` : ""}</option>)}</select><button className="button button-primary" name="action" value="add_member" type="submit">Мүшені қосу</button></form></div>
      <div className="panel"><div className="panel-heading"><div><span>Жабық әкімшілік тіркелу</span><h2>Қонақты қосу</h2></div></div><form action={`/api/events/${id}/participants`} method="post" className="stack-form"><input name="fullName" required maxLength={250} placeholder="Аты-жөні" /><input name="organization" maxLength={500} placeholder="Ұйымы" /><div className="compact-fields"><input name="phone" maxLength={80} placeholder="Телефон" /><input name="email" type="email" maxLength={320} placeholder="Email" /></div><div className="compact-fields"><input name="regionName" maxLength={180} placeholder="Өңір" /><input name="guestGroup" maxLength={180} placeholder="Топ / делегация" /></div><button className="button button-primary" name="action" value="add_guest" type="submit">Қонақты қосу</button></form></div>
    </section>}

    {canManageEventSeating(actor) && <EventSeatingEditor eventId={id} initialType={bundle.event.seatingType} initialUnits={bundle.seatingUnits.map((unit) => ({ id: unit.id, label: unit.label, seatCount: unit.seatCount }))} occupiedSeats={occupiedSeats} />}

    <section className="panel participant-table-panel"><div className="panel-heading"><div><span>Жабық тізім</span><h2><Users size={18} /> Барлық тіркелу</h2></div></div><div className="table-wrap"><table className="data-table participant-table"><thead><tr><th>Қатысушы</th><th>Түрі</th><th>Тіркелу</th><th>Қатысу</th><th>Орын</th><th>Әрекет</th></tr></thead><tbody>{bundle.registrations.map((registration) => <tr key={registration.id} className={registration.registrationStatus === "CANCELLED" ? "muted-row" : ""}><td><strong>{registration.fullName}</strong><small>{registration.organization ?? registration.person?.branch?.regionName ?? registration.regionName ?? "—"}</small></td><td>{participantTypeLabel(registration.participantType)}</td><td>{registrationStatusLabel(registration.registrationStatus)}</td><td><span className={`attendance-pill ${(registration.attendance?.status ?? "PENDING").toLowerCase()}`}>{attendanceStatusLabel(registration.attendance?.status ?? "PENDING")}</span>{registration.registrationStatus === "REGISTERED" && canManageEventAttendance(actor) && <form action={`/api/events/${id}/participants`} method="post" className="inline-actions"><input type="hidden" name="registrationId" value={registration.id} /><button name="status" value="PRESENT" type="submit">Қатысты</button><button name="status" value="ABSENT" type="submit">Қатыспады</button><button name="status" value="PENDING" type="submit">Тазалау</button><input type="hidden" name="action" value="attendance" /></form>}</td><td>{registration.seatingUnit ? <strong>{event.seatingType === "TABLES" ? `${registration.seatingUnit.label}-үстел · ${registration.seatNumber}-орын` : `${registration.seatingUnit.label} қатары · ${registration.seatNumber}-орын`}</strong> : "—"}{registration.registrationStatus === "REGISTERED" && canManageEventSeating(actor) && bundle.seatingUnits.length > 0 && <form action={`/api/events/${id}/participants`} method="post" className="seat-form seat-picker-form"><input type="hidden" name="registrationId" value={registration.id} /><select aria-label={`${registration.fullName} орнын таңдау`} name="seatKey" defaultValue={registration.seatingUnitId && registration.seatNumber ? `${registration.seatingUnitId}:${registration.seatNumber}` : ""}><option value="">Орын бекітілмесін</option>{bundle.seatingUnits.map((unit) => <optgroup label={event.seatingType === "TABLES" ? `${unit.label}-үстел` : `${unit.label} қатары`} key={unit.id}>{Array.from({ length: unit.seatCount }, (_, index) => { const seatNumber = index + 1; const seatKey = `${unit.id}:${seatNumber}`; const occupantId = occupiedSeatKeys.get(seatKey); return <option disabled={Boolean(occupantId && occupantId !== registration.id)} value={seatKey} key={seatKey}>{seatNumber}-орын{occupantId && occupantId !== registration.id ? " · бос емес" : " · бос"}</option>; })}</optgroup>)}</select><button name="action" value="assign_seat" type="submit">Сақтау</button></form>}</td><td>{canManageEventParticipants(actor) && (registration.registrationStatus === "REGISTERED" ? <form action={`/api/events/${id}/participants`} method="post" className="cancel-form"><input type="hidden" name="registrationId" value={registration.id} /><input name="reason" required minLength={1} maxLength={1000} placeholder="Себебі" /><button className="text-danger" name="action" value="cancel" type="submit">Тоқтату</button></form> : <form action={`/api/events/${id}/participants`} method="post"><input type="hidden" name="registrationId" value={registration.id} /><button name="action" value="restore" type="submit">Қайтару</button></form>)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
