import { getPublicLiveEvent } from "@/db/event-participation";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const event = await getPublicLiveEvent((await params).slug);
  if (!event) return new Response("Not found", { status: 404 });
  return Response.json(event, { headers: { "cache-control": "no-store" } });
}
