import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import { canAssignProfessionalCategoriesForPerson } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const assignmentSchema = z.object({
  categoryIds: z.array(z.string().min(1).max(120)).max(100),
  reason: z.string().trim().max(500).optional().default(""),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const parsed = assignmentSchema.safeParse({
      categoryIds: [...new Set(form.getAll("categoryIds").filter((value): value is string => typeof value === "string"))],
      reason: form.get("reason") ?? "",
    });
    if (!parsed.success) return Response.redirect(new URL("/dashboard/members?error=categories", request.url), 303);
    const { id: personId } = await context.params;
    await ensureDatabase();
    const database = getDb();
    const person = await database.personProfile.findFirst({
      where: { id: personId, archivedAt: null },
      select: {
        id: true,
        branchId: true,
        departmentAssignments: {
          where: { endedAt: null, department: { archivedAt: null } },
          select: { departmentId: true },
        },
      },
    });
    if (!person) return new Response("Not found", { status: 404 });
    if (!canAssignProfessionalCategoriesForPerson(actor, {
      branchId: person.branchId,
      departmentIds: person.departmentAssignments.map((assignment) => assignment.departmentId),
    })) return new Response("Forbidden", { status: 403 });

    const [selectedCategories, currentAssignments] = await Promise.all([
      database.professionalCategory.findMany({
        where: { id: { in: parsed.data.categoryIds } },
        select: { id: true, name: true, status: true },
      }),
      database.personProfessionalCategoryAssignment.findMany({
        where: { personId, removedAt: null },
        include: { category: { select: { id: true, name: true, status: true } } },
      }),
    ]);
    if (selectedCategories.length !== parsed.data.categoryIds.length) {
      return Response.redirect(new URL("/dashboard/members?error=categories", request.url), 303);
    }
    const currentByCategory = new Map(currentAssignments.map((assignment) => [assignment.categoryId, assignment]));
    if (selectedCategories.some((category) => category.status !== "active" && !currentByCategory.has(category.id))) {
      return Response.redirect(new URL("/dashboard/members?error=categories", request.url), 303);
    }
    const selectedIds = new Set(parsed.data.categoryIds);
    const additions = selectedCategories.filter((category) => !currentByCategory.has(category.id));
    const removals = currentAssignments.filter((assignment) => !selectedIds.has(assignment.categoryId));
    if (additions.length === 0 && removals.length === 0) {
      return Response.redirect(new URL("/dashboard/members?success=categories-nochange", request.url), 303);
    }

    const now = new Date();
    await database.$transaction([
      ...additions.map((category) => database.personProfessionalCategoryAssignment.create({ data: {
        id: crypto.randomUUID(),
        personId,
        categoryId: category.id,
        assignedBy: actor.id,
        assignedAt: now,
      } })),
      ...removals.map((assignment) => database.personProfessionalCategoryAssignment.update({
        where: { id: assignment.id },
        data: { removedBy: actor.id, removedAt: now },
      })),
      ...additions.map((category) => database.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: actor.id,
        actionType: "professional_category.assigned",
        targetEntity: "person_profile",
        targetEntityId: personId,
        previousValue: JSON.stringify({ categoryId: category.id, categoryName: category.name, assigned: false }),
        newValue: JSON.stringify({ categoryId: category.id, categoryName: category.name, assigned: true }),
        reason: parsed.data.reason || "Кәсіби санат ресми тағайындалды",
        ipAddress: clientIp(request),
        sessionId: actor.sessionId,
        createdAt: now,
      } })),
      ...removals.map((assignment) => database.auditLog.create({ data: {
        id: crypto.randomUUID(),
        actorUserId: actor.id,
        actionType: "professional_category.removed",
        targetEntity: "person_profile",
        targetEntityId: personId,
        previousValue: JSON.stringify({ categoryId: assignment.category.id, categoryName: assignment.category.name, assigned: true }),
        newValue: JSON.stringify({ categoryId: assignment.category.id, categoryName: assignment.category.name, assigned: false }),
        reason: parsed.data.reason || "Кәсіби санат профилден алынды",
        ipAddress: clientIp(request),
        sessionId: actor.sessionId,
        createdAt: now,
      } })),
    ]);
    return Response.redirect(new URL("/dashboard/members?success=categories", request.url), 303);
  } catch {
    return Response.redirect(new URL("/dashboard/members?error=categories", request.url), 303);
  }
}
