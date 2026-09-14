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
  reason: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor || !canManageProfessionalCategoryCatalog(actor)) return new Response("Forbidden", { status: 403 });
    const parsed = categorySchema.safeParse(Object.fromEntries((await request.formData()).entries()));
    if (!parsed.success) return Response.redirect(new URL("/dashboard/categories?error=validation", request.url), 303);
    await ensureDatabase();
    const database = getDb();
    const now = new Date();
    const id = `professional-category-${crypto.randomUUID()}`;
    const category = {
      id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await database.$transaction([
      database.professionalCategory.create({ data: category }),
      database.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: actor.id,
        actionType: "professional_category.created",
        targetEntity: "professional_category",
        targetEntityId: id,
        previousValue: null,
        newValue: JSON.stringify({ name: category.name, description: category.description, sortOrder: category.sortOrder, status: category.status }),
        reason: parsed.data.reason || "Кәсіби санат құрылды",
        ipAddress: clientIp(request),
        sessionId: actor.sessionId,
        createdAt: now,
      } }),
    ]);
    return Response.redirect(new URL("/dashboard/categories?success=created", request.url), 303);
  } catch {
    return Response.redirect(new URL("/dashboard/categories?error=unexpected", request.url), 303);
  }
}
