import { notFound } from "next/navigation";
import { EventLiveScreen } from "@/app/components/EventLiveScreen";
import { getPublicLiveEvent } from "@/db/event-participation";

export const dynamic = "force-dynamic";

export default async function EventScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getPublicLiveEvent((await params).slug);
  if (!event) notFound();
  return <EventLiveScreen initial={{ ...event, startAt: event.startAt.toISOString(), endAt: event.endAt.toISOString() }} />;
}
