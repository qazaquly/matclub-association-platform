"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileLock2, Trash2 } from "lucide-react";
import { educationLevels } from "@/lib/membership-application";

type FieldErrors = Record<string, string>;
type DraftDocument = { id: string; originalName: string; mimeType: string; sizeBytes: number };
type DraftValues = {
  surname: string;
  givenName: string;
  patronymic: string;
  birthDate: string;
  regionCode: string;
  cityDistrict: string;
  phone: string;
  workplace: string;
  position: string;
  educationLevelCode: string;
  educationInstitution: string;
  educationProgram: string;
  mathSpecialization: string;
  achievements: string;
  joiningPurpose: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

const blankDraft: DraftValues = {
  surname: "", givenName: "", patronymic: "", birthDate: "", regionCode: "", cityDistrict: "", phone: "",
  workplace: "", position: "", educationLevelCode: "", educationInstitution: "", educationProgram: "",
  mathSpecialization: "", achievements: "", joiningPurpose: "", termsAccepted: false, privacyAccepted: false,
};
const textFields = [
  "surname", "givenName", "patronymic", "birthDate", "regionCode", "cityDistrict", "phone", "workplace",
  "position", "educationLevelCode", "educationInstitution", "educationProgram", "mathSpecialization", "achievements", "joiningPurpose",
] as const;

function FieldError({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? <small className="field-error" id={`${name}-error`}>{errors[name]}</small> : null;
}

function adultDateLimit() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().slice(0, 10);
}

export function MembershipApplicationForm({
  branches,
  source,
  initialDraft,
  initialDocuments,
}: {
  branches: Array<{ regionCode: string; regionName: string; status: string }>;
  source: "web" | "qr";
  initialDraft?: Partial<DraftValues>;
  initialDocuments?: DraftDocument[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [documents, setDocuments] = useState<DraftDocument[]>(initialDocuments ?? []);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialDraft ? "saved" : "idle");
  const [submitting, setSubmitting] = useState(false);
  const defaults = { ...blankDraft, ...initialDraft };
  const invalid = (name: string) => errors[name] ? "field-invalid" : undefined;

  function values() {
    const data = new FormData(formRef.current!);
    const result: Record<string, unknown> = {
      source,
      termsAccepted: data.get("termsAccepted") === "on",
      privacyAccepted: data.get("privacyAccepted") === "on",
    };
    for (const name of textFields) result[name] = String(data.get(name) ?? "");
    return result;
  }

  async function performSave(showErrors: boolean) {
    setSaveState("saving");
    try {
      const response = await fetch("/api/application-drafts", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(values()),
      });
      const result = await response.json() as { draft?: { documents?: DraftDocument[] }; errors?: FieldErrors; message?: string };
      if (!response.ok) {
        if (showErrors) setErrors({ ...(result.errors ?? {}), ...(result.message ? { form: result.message } : {}) });
        setSaveState("error");
        return false;
      }
      if (result.draft?.documents) setDocuments(result.draft.documents);
      setSaveState("saved");
      return true;
    } catch {
      if (showErrors) setErrors({ form: "Draft-ты сақтау мүмкін болмады. Интернет байланысын тексеріңіз." });
      setSaveState("error");
      return false;
    }
  }

  function saveDraft(showErrors: boolean) {
    const next = saveQueueRef.current.then(() => performSave(showErrors));
    saveQueueRef.current = next.catch(() => false);
    return next;
  }

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void saveDraft(false); }, 900);
  }

  async function uploadDocuments(fileList: FileList | null) {
    if (!fileList?.length || !(await saveDraft(true))) return;
    setSaveState("saving");
    const body = new FormData();
    for (const file of Array.from(fileList)) body.append("documents", file);
    const response = await fetch("/api/application-drafts/documents", { method: "POST", body, credentials: "same-origin", headers: { accept: "application/json" } });
    const result = await response.json() as { documents?: DraftDocument[]; errors?: FieldErrors; message?: string };
    if (!response.ok) {
      setErrors((current) => ({ ...current, ...(result.errors ?? {}), ...(result.message ? { documents: result.message } : {}) }));
      setSaveState("error");
      return;
    }
    setDocuments(result.documents ?? []);
    setErrors((current) => { const next = { ...current }; delete next.documents; return next; });
    setSaveState("saved");
  }

  async function removeDocument(id: string) {
    const response = await fetch(`/api/application-drafts/documents/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin", headers: { accept: "application/json" } });
    if (response.ok) setDocuments((current) => current.filter((document) => document.id !== id));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    if (!(await saveDraft(true))) return setSubmitting(false);
    try {
      const response = await fetch("/api/applications", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(values()),
      });
      const result = await response.json() as { url?: string; errors?: FieldErrors; message?: string };
      if (response.ok && result.url) return window.location.assign(result.url);
      const nextErrors = { ...(result.errors ?? {}), ...(result.message ? { form: result.message } : {}) };
      setErrors(nextErrors);
      const first = Object.keys(nextErrors).find((name) => name !== "form");
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    } catch {
      setErrors({ form: "Өтініш жіберілмеді. Енгізілген деректер draft-та сақталды." });
    } finally {
      setSubmitting(false);
    }
  }

  return <form ref={formRef} className="application-form" onSubmit={submit} onInput={scheduleSave} noValidate>
    <input type="hidden" name="source" value={source} />
    <div className="application-steps" aria-label="Өтініш кезеңдері"><span><b>1</b> Жеке деректер</span><span><b>2</b> Кәсіби мәліметтер</span><span><b>3</b> Құжаттар және келісімдер</span></div>
    <div className={`draft-status ${saveState}`} aria-live="polite">{saveState === "saving" ? "Draft сақталуда…" : saveState === "saved" ? "Draft серверде сақталды" : saveState === "error" ? "Draft-ты сақтау қажет" : "Деректер автоматты түрде сақталады"}</div>
    {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

    <fieldset><legend><b>1</b> Жеке деректер</legend><div className="form-grid">
      <label className={invalid("surname")}>Тегі *<input name="surname" required maxLength={80} autoComplete="family-name" defaultValue={defaults.surname} aria-invalid={Boolean(errors.surname)} /><FieldError name="surname" errors={errors} /></label>
      <label className={invalid("givenName")}>Аты *<input name="givenName" required maxLength={80} autoComplete="given-name" defaultValue={defaults.givenName} aria-invalid={Boolean(errors.givenName)} /><FieldError name="givenName" errors={errors} /></label>
      <label className={invalid("patronymic")}>Әкесінің аты <span className="optional-label">міндетті емес</span><input name="patronymic" maxLength={80} autoComplete="additional-name" defaultValue={defaults.patronymic} aria-invalid={Boolean(errors.patronymic)} /><FieldError name="patronymic" errors={errors} /></label>
      <label className={invalid("birthDate")}>Туған күні *<input name="birthDate" type="date" required min="1900-01-01" max={adultDateLimit()} defaultValue={defaults.birthDate} aria-invalid={Boolean(errors.birthDate)} /><FieldError name="birthDate" errors={errors} /></label>
      <label className={invalid("regionCode")}>Өңір *<select name="regionCode" required defaultValue={defaults.regionCode} aria-invalid={Boolean(errors.regionCode)}><option value="" disabled>Өңірді таңдаңыз</option>{branches.filter((branch) => branch.status === "active").map((branch) => <option value={branch.regionCode} key={branch.regionCode}>{branch.regionName}</option>)}</select><FieldError name="regionCode" errors={errors} /></label>
      <label className={invalid("cityDistrict")}>Қала / аудан *<input name="cityDistrict" required maxLength={120} defaultValue={defaults.cityDistrict} aria-invalid={Boolean(errors.cityDistrict)} /><FieldError name="cityDistrict" errors={errors} /></label>
      <label className={invalid("phone")}>Телефон *<input name="phone" required maxLength={30} autoComplete="tel" placeholder="+7 700 000 00 00" defaultValue={defaults.phone} aria-invalid={Boolean(errors.phone)} /><FieldError name="phone" errors={errors} /></label>
    </div></fieldset>

    <fieldset><legend><b>2</b> Кәсіби мәліметтер</legend><div className="form-grid">
      <label>Қазіргі жұмыс немесе оқу орны <span className="optional-label">міндетті емес</span><input name="workplace" maxLength={240} defaultValue={defaults.workplace} /></label>
      <label>Лауазымы немесе мәртебесі <span className="optional-label">міндетті емес</span><input name="position" maxLength={160} placeholder="Мұғалім, студент, зерттеуші…" defaultValue={defaults.position} /></label>
      <label className={invalid("educationLevelCode")}>Білім деңгейі *<select name="educationLevelCode" required defaultValue={defaults.educationLevelCode} aria-invalid={Boolean(errors.educationLevelCode)}><option value="" disabled>Білім деңгейін таңдаңыз</option>{educationLevels.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select><FieldError name="educationLevelCode" errors={errors} /></label>
      <label>Білім алған немесе алып жатқан оқу орны <span className="optional-label">міндетті емес</span><input name="educationInstitution" maxLength={240} defaultValue={defaults.educationInstitution} /></label>
      <label className="span-2">Мамандығы / білім беру бағдарламасы <span className="optional-label">міндетті емес</span><input name="educationProgram" maxLength={240} defaultValue={defaults.educationProgram} /></label>
      <label className="span-2">Математикадағы бағыты / мамандануы <span className="optional-label">міндетті емес</span><textarea name="mathSpecialization" maxLength={500} rows={2} defaultValue={defaults.mathSpecialization} /></label>
      <label className="span-2">Кәсіби жетістіктері <span className="optional-label">міндетті емес</span><textarea name="achievements" maxLength={3000} rows={3} defaultValue={defaults.achievements} /></label>
      <label className={`span-2 ${invalid("joiningPurpose") ?? ""}`}>Бірлестікке қосылу мақсаты *<textarea name="joiningPurpose" required minLength={10} maxLength={500} rows={3} defaultValue={defaults.joiningPurpose} aria-invalid={Boolean(errors.joiningPurpose)} /><FieldError name="joiningPurpose" errors={errors} /></label>
    </div></fieldset>

    <fieldset><legend><b>3</b> Құжаттар және келісімдер</legend>
      <label className={`file-drop ${invalid("documents") ?? ""}`}><FileLock2 size={26} /><strong>Қосымша құжаттарды тіркеу</strong><span>Міндетті емес · PDF, JPG немесе PNG · 3 файлға дейін, әрқайсысы 5 МБ-қа дейін</span><input name="documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => void uploadDocuments(event.currentTarget.files)} aria-invalid={Boolean(errors.documents)} /></label>
      <FieldError name="documents" errors={errors} />
      {documents.length > 0 && <div className="draft-document-list">{documents.map((document) => <div key={document.id}><span><strong>{document.originalName}</strong><small>{Math.ceil(document.sizeBytes / 1024)} КБ · draft-та сақталған</small></span><button type="button" onClick={() => void removeDocument(document.id)} aria-label={`${document.originalName} құжатын алып тастау`}><Trash2 size={16} /></button></div>)}</div>}
      <label className={`terms-check ${invalid("termsAccepted") ?? ""}`}><input name="termsAccepted" type="checkbox" defaultChecked={defaults.termsAccepted} aria-invalid={Boolean(errors.termsAccepted)} /><span><a href="/membership/terms" target="_blank" rel="noreferrer">Мүшелік шарттарымен</a> таныстым және қабылдаймын.<FieldError name="termsAccepted" errors={errors} /></span></label>
      <label className={`terms-check ${invalid("privacyAccepted") ?? ""}`}><input name="privacyAccepted" type="checkbox" defaultChecked={defaults.privacyAccepted} aria-invalid={Boolean(errors.privacyAccepted)} /><span><a href="/privacy" target="_blank" rel="noreferrer">Дербес деректерді өңдеу тәртібімен</a> таныстым және дербес деректерімді өңдеуге келісемін.<FieldError name="privacyAccepted" errors={errors} /></span></label>
    </fieldset>
    <button className="button button-primary submit-button" type="submit" disabled={submitting}>{submitting ? "Жіберілуде…" : <>Өтінішті жіберу <CheckCircle2 size={18} /></>}</button>
  </form>;
}
