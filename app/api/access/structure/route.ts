import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { ensureDatabase } from "@/db/bootstrap";
import { getDb } from "@/db";
import { lockAccessGovernance } from "@/lib/access-governance";
import { authenticateRequest } from "@/lib/auth";
import { canManageRoles } from "@/lib/authorization";
import { assertSameOrigin, clientIp } from "@/lib/security";

const unitFields = {
  nameKk: z.string().trim().min(2).max(160),
  unitType: z.string().trim().min(2).max(80),
  parentId: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().max(1500).optional().default(""),
  reason: z.string().trim().min(5).max(500),
};

const structureSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...unitFields }),
  z.object({ action: z.literal("update"), departmentId: z.string().min(1), ...unitFields }),
  z.object({
    action: z.literal("archive"),
    departmentId: z.string().min(1),
    reason: z.string().trim().min(5).max(500),
  }),
]);

class StructureError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

type UnitSnapshot = {
  id: string;
  code: string;
  nameKk: string;
  unitType: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  archivedAt: string | null;
};

function normalizeUnitName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("kk-KZ").replace(/\s+/g, " ").trim();
}

function snapshot(unit: {
  id: string;
  code: string;
  nameKk: string;
  unitType: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  archivedAt: Date | null;
}): UnitSnapshot {
  return {
    id: unit.id,
    code: unit.code,
    nameKk: unit.nameKk,
    unitType: unit.unitType,
    parentId: unit.parentId,
    description: unit.description,
    sortOrder: unit.sortOrder,
    archivedAt: unit.archivedAt?.toISOString() ?? null,
  };
}

async function assertValidParent(
  tx: Prisma.TransactionClient,
  departmentId: string | null,
  parentId: string | null,
) {
  if (!parentId) return;
  if (parentId === departmentId) throw new StructureError("cycle");
  const units = await tx.department.findMany({
    where: { archivedAt: null },
    select: { id: true, parentId: true },
  });
  const parents = new Map(units.map((unit) => [unit.id, unit.parentId]));
  if (!parents.has(parentId)) throw new StructureError("parent");
  let cursor: string | null = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === departmentId || visited.has(cursor)) throw new StructureError("cycle");
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
}

async function assertUniqueName(
  tx: Prisma.TransactionClient,
  nameKey: string,
  parentId: string | null,
  excludeId?: string,
) {
  const siblings = await tx.department.findMany({
    where: {
      parentId,
      archivedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { nameKk: true },
  });
  if (siblings.some((unit) => normalizeUnitName(unit.nameKk) === nameKey)) throw new StructureError("duplicate");
}

export async function POST(request: Request) {
  assertSameOrigin(request);
  const actor = await authenticateRequest(request);
  if (!actor || !canManageRoles(actor)) return new Response("Forbidden", { status: 403 });
  const parsed = structureSchema.safeParse(Object.fromEntries((await request.formData()).entries()));
  if (!parsed.success) return Response.redirect(new URL("/dashboard/access?error=structure-validation", request.url), 303);
  await ensureDatabase();
  const database = getDb();
  const now = new Date();
  const data = parsed.data;

  try {
    await database.$transaction(async (tx) => {
      await lockAccessGovernance(tx);

      if (data.action === "create") {
        const parentId = data.parentId || null;
        const nameKey = normalizeUnitName(data.nameKk);
        await assertValidParent(tx, null, parentId);
        await assertUniqueName(tx, nameKey, parentId);
        const id = crypto.randomUUID();
        const created = await tx.department.create({
          data: {
            id,
            code: `unit-${id}`,
            nameKk: data.nameKk,
            nameKey,
            unitType: data.unitType,
            parentId,
            description: data.description || null,
            createdAt: now,
            updatedAt: now,
          },
        });
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            actorUserId: actor.id,
            actionType: "organizational_unit.created",
            targetEntity: "organizational_unit",
            targetEntityId: created.id,
            newValue: JSON.stringify(snapshot(created)),
            reason: data.reason,
            ipAddress: clientIp(request),
            sessionId: actor.sessionId,
            createdAt: now,
          },
        });
        return;
      }

      const current = await tx.department.findFirst({
        where: { id: data.departmentId, archivedAt: null },
      });
      if (!current) throw new StructureError("not-found");

      if (data.action === "update") {
        const parentId = data.parentId || null;
        const nameKey = normalizeUnitName(data.nameKk);
        await assertValidParent(tx, current.id, parentId);
        await assertUniqueName(tx, nameKey, parentId, current.id);
        const updated = await tx.department.update({
          where: { id: current.id },
          data: {
            nameKk: data.nameKk,
            nameKey,
            unitType: data.unitType,
            parentId,
            description: data.description || null,
            updatedAt: now,
          },
        });
        const previousValue = snapshot(current);
        const newValue = snapshot(updated);
        if (JSON.stringify(previousValue) === JSON.stringify(newValue)) throw new StructureError("no-change");
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            actorUserId: actor.id,
            actionType: "organizational_unit.updated",
            targetEntity: "organizational_unit",
            targetEntityId: updated.id,
            previousValue: JSON.stringify(previousValue),
            newValue: JSON.stringify(newValue),
            reason: data.reason,
            ipAddress: clientIp(request),
            sessionId: actor.sessionId,
            createdAt: now,
          },
        });
        return;
      }

      const [activeChildren, activeMembers, activeRoles] = await Promise.all([
        tx.department.count({ where: { parentId: current.id, archivedAt: null } }),
        tx.personDepartmentAssignment.count({ where: { departmentId: current.id, endedAt: null } }),
        tx.userRole.count({ where: { scopeType: "department", scopeId: current.id, revokedAt: null } }),
      ]);
      if (activeChildren || activeMembers || activeRoles) throw new StructureError("in-use");
      const archived = await tx.department.update({
        where: { id: current.id },
        data: { archivedAt: now, updatedAt: now },
      });
      await tx.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          actorUserId: actor.id,
          actionType: "organizational_unit.archived",
          targetEntity: "organizational_unit",
          targetEntityId: archived.id,
          previousValue: JSON.stringify(snapshot(current)),
          newValue: JSON.stringify(snapshot(archived)),
          reason: data.reason,
          ipAddress: clientIp(request),
          sessionId: actor.sessionId,
          createdAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof StructureError) {
      if (error.code === "not-found") return new Response("Not found", { status: 404 });
      return Response.redirect(new URL(`/dashboard/access?error=structure-${error.code}`, request.url), 303);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.redirect(new URL("/dashboard/access?error=structure-duplicate", request.url), 303);
    }
    throw error;
  }

  return Response.redirect(new URL("/dashboard/access?success=structure", request.url), 303);
}
