import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { normalizeDraftInput } from "@/lib/membership-application";
import { assertSameOrigin } from "@/lib/security";
import { logRuntimeError } from "@/lib/runtime-error";

function draftSelect() {
  return {
    id: true,
    status: true,
    updatedAt: true,
    documents: {
      where: { status: "active", archivedAt: null },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
      orderBy: { createdAt: "asc" as const },
    },
  };
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.emailVerifiedAt) return Response.json({ error: "email_unverified", message: "Электрондық поштаңызды растаңыз." }, { status: 403 });
  await ensureDatabase();
  const draft = await getDb().membershipApplicationDraft.findUnique({ where: { userId: user.id }, select: draftSelect() });
  if (!draft) return Response.json({ error: "draft_not_found" }, { status: 404 });
  return Response.json({ draft });
}

export async function POST(request: Request) {
  let stage = "request";
  try {
    assertSameOrigin(request);
    stage = "authentication";
    const user = await authenticateRequest(request);
    if (!user) return Response.json({ error: "unauthorized", message: "Алдымен жүйеге кіріңіз." }, { status: 401 });
    if (!user.emailVerifiedAt) return Response.json({ error: "email_unverified", message: "Электрондық поштаңызды растаңыз." }, { status: 403 });
    if (user.membershipStatus !== "registered_user") return Response.json({ error: "application_already_submitted" }, { status: 409 });
    stage = "database";
    await ensureDatabase();
    stage = "draft_input";
    const values = normalizeDraftInput(await request.json() as Record<string, unknown>);
    const database = getDb();
    stage = "draft_lookup";
    let draft = await database.membershipApplicationDraft.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
    if (!draft) {
      stage = "draft_create";
      draft = await database.membershipApplicationDraft.create({
        data: { id: crypto.randomUUID(), userId: user.id, personId: user.profileId, ...values },
        select: { id: true, status: true },
      });
    }
    if (draft.status !== "draft") return Response.json({ saved: true, status: draft.status });
    stage = "draft_update";
    const saved = await database.membershipApplicationDraft.update({ where: { id: draft.id }, data: values, select: draftSelect() });
    return Response.json({ saved: true, draft: saved });
  } catch (error) {
    logRuntimeError("application.draft_save.runtime_error", stage, error);
    return Response.json({ error: "unexpected", message: "Draft-ты сақтау мүмкін болмады. Қайталап көріңіз." }, { status: 500 });
  }
}
