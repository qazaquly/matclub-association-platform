import { getDb } from "@/db";
import { authenticateRequest } from "@/lib/auth";
import {
  branchScopeIds,
  canManageBranchInstitutionalDocuments,
  canManageDepartmentInstitutionalDocuments,
  canManageGlobalInstitutionalDocuments,
  institutionalDocumentDepartmentScopeIds,
} from "@/lib/authorization";
import { parseInstitutionalDocumentForm, parseInstitutionalDocumentUpload, validInstitutionalDocumentSignature } from "@/lib/institutional-documents";
import { assertSameOrigin, clientIp, sha256Hex } from "@/lib/security";
import { getPrivateObjectStorage } from "@/lib/storage";

function redirect(request: Request, ok: boolean, code: string, id?: string) {
  const path = id ? `/dashboard/documents/${id}` : "/dashboard/documents";
  return Response.redirect(new URL(`${path}?${ok ? "success" : "error"}=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request) {
  let objectKey: string | null = null;
  try {
    assertSameOrigin(request);
    const actor = await authenticateRequest(request);
    if (!actor) return new Response("Unauthorized", { status: 401 });
    const form = await request.formData();
    const input = parseInstitutionalDocumentForm(form);
    const { file, changeNote } = parseInstitutionalDocumentUpload(form);
    const global = canManageGlobalInstitutionalDocuments(actor);
    const branchAllowed = input.scopeType === "BRANCH" && input.branchId && canManageBranchInstitutionalDocuments(actor) && branchScopeIds(actor).includes(input.branchId);
    const departmentAllowed = input.scopeType === "NATIONAL" && input.responsibleDepartmentId && canManageDepartmentInstitutionalDocuments(actor) && institutionalDocumentDepartmentScopeIds(actor).includes(input.responsibleDepartmentId);
    if (!global && !branchAllowed && !departmentAllowed) return new Response("Forbidden", { status: 403 });
    if (!global && input.accessLevel === "LEADERSHIP") return new Response("Forbidden", { status: 403 });

    const body = await file.arrayBuffer();
    if (!validInstitutionalDocumentSignature(file.type, body)) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:signature");
    const database = getDb();
    if (input.branchId && !(await database.branch.findFirst({ where: { id: input.branchId, status: "active", archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:branchId");
    if (input.responsibleDepartmentId && !(await database.department.findFirst({ where: { id: input.responsibleDepartmentId, archivedAt: null }, select: { id: true } }))) throw new Error("INVALID_INSTITUTIONAL_DOCUMENT:responsibleDepartmentId");

    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    objectKey = `institutional-documents/${id}/versions/1-${versionId}`;
    await getPrivateObjectStorage().put(objectKey, body);
    const now = new Date();
    await database.$transaction(async (transaction) => {
      const created = await transaction.institutionalDocument.create({ data: {
        id, ...input, status: "ACTIVE", createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now,
      } });
      await transaction.institutionalDocumentVersion.create({ data: {
        id: versionId, documentId: id, versionNumber: 1, objectKey: objectKey!, originalName: file.name.slice(0, 240), mimeType: file.type,
        sizeBytes: file.size, checksumSha256: await sha256Hex(body), changeNote: changeNote ?? "Алғашқы нұсқа", uploadedBy: actor.id, createdAt: now,
      } });
      await transaction.auditLog.create({ data: {
        id: crypto.randomUUID(), actorUserId: actor.id, actionType: "institutional_document.created", targetEntity: "institutional_document", targetEntityId: id,
        newValue: JSON.stringify({ title: created.title, documentNumber: created.documentNumber, documentDate: created.documentDate, documentType: created.documentType, scopeType: created.scopeType, branchId: created.branchId, responsibleDepartmentId: created.responsibleDepartmentId, accessLevel: created.accessLevel, versionNumber: 1, originalName: file.name }),
        reason: "Ішкі ресми құжат тіркелді", ipAddress: clientIp(request), sessionId: actor.sessionId, createdAt: now,
      } });
    });
    objectKey = null;
    return redirect(request, true, "created", id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return redirect(request, false, message.includes("Unique constraint") ? "duplicate" : "validation");
  } finally {
    if (objectKey) await getPrivateObjectStorage().delete(objectKey).catch(() => undefined);
  }
}
