import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  canManageGlobalInstitutionalDocuments,
  canManageInstitutionalDocument,
} from "@/lib/authorization";
import { parseInstitutionalDocumentForm } from "@/lib/institutional-documents";
import { assertSameOrigin, clientIp } from "@/lib/security";

function redirect(request: Request, id: string, ok: boolean, code: string) {
  return Response.redirect(new URL(`/dashboard/documents/${id}?${ok ? "success" : "error"}=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const database = getDb();
    const current = await database.institutionalDocument.findUnique({ where: { id } });
    if (!current) return new Response("Not found", { status: 404 });
    if (!canManageInstitutionalDocument(actor, current)) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") ?? "update");
    const now = new Date();

    if (action === "update") {
      if (current.status === "ARCHIVED") return redirect(request, id, false, "archived");
      const input = parseInstitutionalDocumentForm(form);
      const global = canManageGlobalInstitutionalDocuments(actor);
      if (!global && (input.scopeType !== current.scopeType || input.branchId !== current.branchId || input.responsibleDepartmentId !== current.responsibleDepartmentId || input.accessLevel === "LEADERSHIP")) return new Response("Forbidden", { status: 403 });
      if (input.branchId && !(await database.branch.findFirst({ where: { id: input.branchId, status: "active", archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:branchId");
      if (input.responsibleDepartmentId && !(await database.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:responsibleDepartmentId");
      await database.$transaction(async (transaction) => {
        const updated = await transaction.institutionalDocument.update({ where: { id }, data: { ...input, updatedBy: actor.id, updatedAt: now } });
        await transaction.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: "institutional_document.updated", targetEntity: "institutional_document", targetEntityId: id,
          previousValue: JSON.stringify(current), newValue: JSON.stringify(updated), reason: "Ресми құжаттың метадерегі жаңартылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } });
      });
      return redirect(request, id, true, "updated");
    }

    if (action === "status") {
      const status = String(form.get("status") ?? "");
      if (!((current.status === "ACTIVE" && status === "ARCHIVED") || (current.status === "ARCHIVED" && status === "ACTIVE"))) return redirect(request, id, false, "status");
      const reason = String(form.get("reason") ?? "").trim().slice(0, 2_000);
      if (status === "ARCHIVED" && !reason) return redirect(request, id, false, "reason");
      await database.$transaction([
        database.institutionalDocument.update({ where: { id }, data: { status, archivedAt: status === "ARCHIVED" ? now : null, updatedBy: actor.id, updatedAt: now } }),
        database.auditLog.create({ data: {
          id: crypto.randomUUID(), actorUserId: actor.id, actionType: `institutional_document.${status === "ARCHIVED" ? "archived" : "restored"}`, targetEntity: "institutional_document", targetEntityId: id,
          previousValue: JSON.stringify({ status: current.status }), newValue: JSON.stringify({ status }), reason: reason || "Ресми құжат архивтен қайтарылды", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
        } }),
      ]);
      return redirect(request, id, true, status.toLowerCase());
    }
    return redirect(request, id, false, "action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return redirect(request, id, false, message.includes("Unique constraint") ? "duplicate" : "validation");
  }
}
