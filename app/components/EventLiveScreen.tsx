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
  useEffect(() => {
    const update = async () => {
      const response = await fetch(`/api/events/public/${encodeURIComponent(initial.slug)}/status`, { cache: "no-store" });
      if (response.ok) setEvent(await response.json() as LiveState);
    };
    const timer = window.setInterval(() => void update(), 10_000);
    return () => window.clearInterval(timer);
  }, [initial.slug]);

  return <main className="event-live-screen">
    <a href={`/events/${event.slug}`}>← Іс-шара беті</a>
    <div className="event-live-heading"><span>Тікелей көрсеткіш · әр 10 секунд сайын жаңарады</span><h1>{event.title}</h1><p>{event.summary}</p></div>
    <div className="event-live-metrics">
      <article><span>Тіркелген</span><strong>{event.registered}</strong></article>
      <article className="present"><span>Қатысты</span><strong>{event.present}</strong></article>
      <article><span>Қатыспады</span><strong>{event.absent}</strong></article>
      {event.remaining != null && <article><span>Қалған орын</span><strong>{event.remaining}</strong></article>}
    </div>
    <small>Қатысушылардың аты-жөні құпиялық үшін бұл экранда көрсетілмейді.</small>
  </main>;
}
