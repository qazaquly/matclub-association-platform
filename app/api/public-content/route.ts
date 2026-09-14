import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManagePublicContent } from "@/lib/authorization";
import { publicContentDefinitions, validatePublicContentValue } from "@/lib/public-content";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    if (!canManagePublicContent(actor)) return new Response("Forbidden", { status: 403 });

    const form = await request.formData();
    const submitted = publicContentDefinitions.map((definition) => ({
      definition,
      value: validatePublicContentValue(definition.key, form.get(definition.key)),
    }));
    await ensureDatabase();
    const database = getDb();
    const existingRows = await database.publicContent.findMany({ select: { key: true, value: true } });
    const existing = new Map(existingRows.map((row) => [row.key, row.value]));
    const changed = submitted.filter(({ definition, value }) => value !== (existing.get(definition.key) ?? definition.defaultValue));
    if (changed.length === 0) return Response.redirect(new URL("/dashboard/content?success=nochange", request.url), 303);

    const now = new Date();
    const changesJson = JSON.stringify(changed.map(({ definition, value }) => ({
      audit_id: crypto.randomUUID(),
      key: definition.key,
      section: definition.section,
      value,
      value_type: definition.kind,
      previous_value: JSON.stringify({ value: existing.get(definition.key) ?? definition.defaultValue }),
      new_value: JSON.stringify({ value }),
    })));

    // Keep publishing and its append-only audit entries atomic while using one
    // database round trip, even when every editable field changes at once.
    await database.$executeRaw`
      WITH changes AS (
        SELECT *
        FROM jsonb_to_recordset(${changesJson}::jsonb) AS item(
          audit_id text,
          key text,
          section text,
          value text,
          value_type text,
          previous_value text,
          new_value text
        )
      ),
      upserted AS (
        INSERT INTO public_content ("key", section, value, value_type, updated_by, created_at, updated_at)
        SELECT key, section, value, value_type, ${actor.id}, ${now}, ${now}
        FROM changes
        ON CONFLICT ("key") DO UPDATE SET
          section = EXCLUDED.section,
          value = EXCLUDED.value,
          value_type = EXCLUDED.value_type,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
        RETURNING "key"
      )
      INSERT INTO audit_logs (
        id,
        actor_user_id,
        action_type,
        target_entity,
        target_entity_id,
        previous_value,
        new_value,
        reason,
        ip_address,
        session_id,
        created_at
      )
      SELECT
        changes.audit_id,
        ${actor.id},
        'public_content.updated',
        'public_content',
        changes.key,
        changes.previous_value,
        changes.new_value,
        'Ашық сайт мазмұны жарияланды',
        ${clientIp(request)},
        ${actor.sessionId},
        ${now}
      FROM changes
      INNER JOIN upserted ON upserted."key" = changes.key
    `;
    return Response.redirect(new URL("/dashboard/content?success=published", request.url), 303);
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("INVALID_CONTENT") ? "validation" : "unexpected";
    return Response.redirect(new URL(`/dashboard/content?error=${reason}`, request.url), 303);
  }
}
