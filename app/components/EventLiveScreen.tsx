"use client";

import { useEffect, useState } from "react";

interface LiveState {
  slug: string;
  title: string;
  summary: string;
  startAt: string;
  endAt: string;
  participantLimit: number | null;
  status: string;
  registered: number;
  present: number;
  absent: number;
  remaining: number | null;
}

export function EventLiveScreen({ initial }: { initial: LiveState }) {
  const [event, setEvent] = useState(initial);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const response = await fetch(`/api/events/public/${encodeURIComponent(initial.slug)}/status`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const next = await response.json() as LiveState;
        if (!controller.signal.aborted) { setEvent(next); setStale(false); }
      } catch {
        if (!controller.signal.aborted) setStale(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(update, 10_000);
      }
    };
    timer = setTimeout(update, 10_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [initial.slug]);

  return <main className="event-live-screen">
    <a href={`/events/${event.slug}`}>← Іс-шара беті</a>
    <div className="event-live-heading"><span role="status">{stale ? "Байланыс үзілді. Соңғы алынған көрсеткіштер көрсетіліп тұр." : "Тікелей көрсеткіш · әр 10 секунд сайын жаңарады"}</span><h1>{event.title}</h1><p>{event.summary}</p></div>
    <div className="event-live-metrics">
      <article><span>Тіркелген</span><strong>{event.registered}</strong></article>
      <article className="present"><span>Қатысты</span><strong>{event.present}</strong></article>
      <article><span>Қатыспады</span><strong>{event.absent}</strong></article>
      {event.remaining != null && <article><span>Қалған орын</span><strong>{event.remaining}</strong></article>}
    </div>
    <small>Қатысушылардың аты-жөні құпиялық үшін бұл экранда көрсетілмейді.</small>
  </main>;
}
