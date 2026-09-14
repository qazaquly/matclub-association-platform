import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { EventReception } from "@/app/components/EventReception";
import { getEventParticipationBundle } from "@/db/event-participation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessManagedEvent, canManageEventAttendance, canViewEventParticipants } from "@/lib/authorization";

export default async function EventReceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = (await getCurrentUser())!;
  const { id } = await params;
  const bundle = await getEventParticipationBundle(id);
  if (!bundle.event || !canAccessManagedEvent(actor, bundle.event) || !canViewEventParticipants(actor) || !canManageEventAttendance(actor)) notFound();
  const participants = bundle.registrations.filter((item) => item.registrationStatus === "REGISTERED").map((item) => ({
    id: item.id, fullName: item.fullName, organization: item.organization, regionName: item.regionName,
    guestGroup: item.guestGroup, attendance: item.attendance ? { status: item.attendance.status } : null,
    seatingUnit: item.seatingUnit ? { label: item.seatingUnit.label } : null, seatNumber: item.seatNumber,
  }));
  return <main className="dashboard-content reception-page"><a className="back-link" href={`/dashboard/events/${id}/participants`}><ArrowLeft size={15} /> Қатысушылар</a><div className="dash-page-heading"><div><p>Reception</p><h1>{bundle.event.title}</h1></div><span className="environment-pill">Жабық қызметтік экран</span></div><div className="content-admin-note"><p>Бұл жерде аты-жөні толық ізделеді, бірақ тізім тек іс-шараға құқығы бар қызметкерлерге ашық. Ашық сайтта қатысушылардың аты көрсетілмейді.</p></div><EventReception eventId={id} initial={participants} /></main>;
}
