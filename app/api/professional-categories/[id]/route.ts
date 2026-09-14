import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canManageProfessionalCategoryCatalog } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  status: z.enum(["active", "inactive"]),
  reason: z.string().trim().max(500).optional().default(""),
});

const auditActionByField = {
  name: "professional_category.renamed",
  description: "professional_category.description_changed",
  sortOrder: "professional_category.sort_order_changed",
  status: "professional_category.status_changed",
} as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor || !canManageProfessionalCategoryCatalog(actor)) return new Response("Forbidden", { status: 403 });
    const parsed = categorySchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(new URL("/dashboard/categories?error=validation", request.url), 303);
    const { id } = await context.params;
    await ensureDatabase();
    const database = getDb();
    const current = await database.professionalCategory.findUnique({
      where: { id },
      select: { name: true, description: true, sortOrder: true, status: true },
    });
    if (!current) return new Response("Not found", { status: 404 });
    const next = {
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
      status: parsed.data.status,
    };
    const changedFields = (Object.keys(next) as Array<keyof typeof next>).filter((field) => current[field] !== next[field]);
    if (changedFields.length === 0) return Response.redirect(new URL("/dashboard/categories?success=nochange", request.url), 303);
    const now = new Date();
    await database.$transaction([
      database.professionalCategory.update({ where: { id }, data: { ...next, updatedAt: now } }),
      ...changedFields.map((field) => database.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: actor.id,
        actionType: auditActionByField[field],
        targetEntity: "professional_category",
        targetEntityId: id,
        previousValue: JSON.stringify({ [field]: current[field] }),
        newValue: JSON.stringify({ [field]: next[field] }),
        reason: parsed.data.reason || "Кәсіби санат жаңартылды",
        ipAddress: clientIp(request),
        sessionId: actor.sessionId,
        createdAt: now,
      } })),
    ]);
    return Response.redirect(new URL("/dashboard/categories?success=updated", request.url), 303);
  } catch {
    return Response.redirect(new URL("/dashboard/categories?error=unexpected", request.url), 303);
  }
}
