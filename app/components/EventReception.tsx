"use client";

import { useMemo, useState } from "react";

interface ReceptionParticipant {
  id: string;
  fullName: string;
  organization: string | null;
  regionName: string | null;
  guestGroup: string | null;
  attendance: { status: string } | null;
  seatingUnit: { label: string } | null;
  seatNumber: number | null;
}

export function EventReception({ eventId, initial }: { eventId: string; initial: ReceptionParticipant[] }) {
  const [participants, setParticipants] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("kk-KZ");
    if (!needle) return participants;
    return participants.filter((item) => [item.fullName, item.organization, item.regionName, item.guestGroup].filter(Boolean).join(" ").toLocaleLowerCase("kk-KZ").includes(needle));
  }, [participants, query]);

  async function mark(registrationId: string, status: "PRESENT" | "ABSENT") {
    setBusy(registrationId);
    const form = new FormData();
    form.set("action", "attendance"); form.set("registrationId", registrationId); form.set("status", status);
    const response = await fetch(`/api/events/${eventId}/participants`, { method: "POST", body: form, headers: { accept: "application/json" } });
    if (response.ok) setParticipants((items) => items.map((item) => item.id === registrationId ? { ...item, attendance: { status } } : item));
    setBusy(null);
  }

  return <div className="reception-app">
    <div className="reception-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Аты-жөні, ұйымы, өңірі немесе тобы бойынша іздеу" /><span>{filtered.length} нәтиже</span></div>
    <div className="reception-list">{filtered.map((participant) => <article key={participant.id} className={participant.attendance?.status === "PRESENT" ? "checked-in" : ""}><div><strong>{participant.fullName}</strong><p>{[participant.organization, participant.regionName, participant.guestGroup].filter(Boolean).join(" · ") || "Қосымша мәлімет жоқ"}</p>{participant.seatingUnit && <small>Орын: {participant.seatingUnit.label}-{participant.seatNumber}</small>}</div><div><span>{participant.attendance?.status === "PRESENT" ? "Қатысты" : participant.attendance?.status === "ABSENT" ? "Қатыспады" : "Келмеді"}</span><button className="button button-primary" disabled={busy === participant.id} onClick={() => void mark(participant.id, "PRESENT")} type="button">Келді</button><button className="button" disabled={busy === participant.id} onClick={() => void mark(participant.id, "ABSENT")} type="button">Қатыспады</button></div></article>)}</div>
  </div>;
}
