import {
  institutionalDocumentAccessLabel,
  institutionalDocumentAccessLevels,
  institutionalDocumentScopeLabel,
  institutionalDocumentScopes,
  institutionalDocumentTypeLabel,
  institutionalDocumentTypes,
} from "@/lib/institutional-documents";

interface DocumentFormItem {
  title: string;
  documentNumber: string;
  documentDate: Date;
  documentType: string;
  scopeType: string;
  branchId: string | null;
  responsibleDepartmentId: string | null;
  accessLevel: string;
  summary: string | null;
}

interface DocumentFormProps {
  action: string;
  branches: Array<{ id: string; regionName: string }>;
  departments: Array<{ id: string; nameKk: string }>;
  canManageGlobal: boolean;
  canManageBranch: boolean;
  canManageDepartment: boolean;
  item?: DocumentFormItem;
  includeFile?: boolean;
}

export function InstitutionalDocumentForm({ action, branches, departments, canManageGlobal, canManageBranch, canManageDepartment, item, includeFile = false }: DocumentFormProps) {
  const onlyBranch = !canManageGlobal && canManageBranch && !canManageDepartment;
  const onlyDepartment = !canManageGlobal && canManageDepartment && !canManageBranch;
  const scopeValue = item?.scopeType ?? (onlyBranch ? "BRANCH" : "NATIONAL");
  const fixedScope = Boolean(item && !canManageGlobal) || onlyBranch || onlyDepartment;
  const fixedBranch = Boolean(item && !canManageGlobal);
  const fixedDepartment = Boolean(item && !canManageGlobal);
  return <form action={action} className="institutional-document-form" encType={includeFile ? "multipart/form-data" : undefined} method="post">
    {!includeFile && <input name="action" type="hidden" value="update" />}
    <label className="wide"><span>Құжат атауы *</span><input defaultValue={item?.title ?? ""} maxLength={240} name="title" required /></label>
    <label><span>Нөмірі *</span><input defaultValue={item?.documentNumber ?? ""} maxLength={120} name="documentNumber" placeholder="№ 12-Ө" required /></label>
    <label><span>Құжат күні *</span><input defaultValue={item?.documentDate.toISOString().slice(0, 10) ?? ""} name="documentDate" required type="date" /></label>
    <label><span>Құжат түрі *</span><select defaultValue={item?.documentType ?? "ORDER"} name="documentType">{institutionalDocumentTypes.map((type) => <option key={type} value={type}>{institutionalDocumentTypeLabel(type)}</option>)}</select></label>
    <label><span>Деңгей *</span>{fixedScope ? <><input name="scopeType" type="hidden" value={scopeValue} /><input disabled value={institutionalDocumentScopeLabel(scopeValue)} /></> : <select defaultValue={scopeValue} name="scopeType">{institutionalDocumentScopes.filter((scope) => canManageGlobal || (scope === "BRANCH" ? canManageBranch : canManageDepartment)).map((scope) => <option key={scope} value={scope}>{institutionalDocumentScopeLabel(scope)}</option>)}</select>}</label>
    <label><span>Филиал</span>{fixedBranch && item?.branchId ? <><input name="branchId" type="hidden" value={item.branchId} /><input disabled value={branches.find((branch) => branch.id === item.branchId)?.regionName ?? "Бекітілген филиал"} /></> : <select defaultValue={item?.branchId ?? (onlyBranch && branches.length === 1 ? branches[0].id : "")} name="branchId"><option value="">Таңдалмаған</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.regionName}</option>)}</select>}</label>
    <label><span>Жауапты құрылым</span>{fixedDepartment && item?.responsibleDepartmentId ? <><input name="responsibleDepartmentId" type="hidden" value={item.responsibleDepartmentId} /><input disabled value={departments.find((department) => department.id === item.responsibleDepartmentId)?.nameKk ?? "Бекітілген құрылым"} /></> : <select defaultValue={item?.responsibleDepartmentId ?? (onlyDepartment && departments.length === 1 ? departments[0].id : "")} name="responsibleDepartmentId"><option value="">Таңдалмаған</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.nameKk}</option>)}</select>}</label>
    <label><span>Қолжетімділік *</span><select defaultValue={item?.accessLevel ?? "RESPONSIBLE"} name="accessLevel">{institutionalDocumentAccessLevels.filter((level) => canManageGlobal || level !== "LEADERSHIP").map((level) => <option key={level} value={level}>{institutionalDocumentAccessLabel(level)}</option>)}</select></label>
    <label className="wide"><span>Қысқаша мазмұны</span><textarea defaultValue={item?.summary ?? ""} maxLength={5000} name="summary" rows={4} /></label>
    {includeFile && <><label className="wide"><span>Алғашқы файл *</span><input accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx" name="document" required type="file" /></label><label className="wide"><span>Нұсқа түсіндірмесі</span><input maxLength={1000} name="changeNote" placeholder="Алғашқы бекітілген нұсқа" /></label></>}
    <div className="wide document-form-actions"><button className="button button-primary" type="submit">{includeFile ? "Құжатты қорға қосу" : "Деректерді сақтау"}</button></div>
  </form>;
}
