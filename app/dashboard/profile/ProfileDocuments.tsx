"use client";

import { useState } from "react";
import { FileLock2, Send, Trash2, Upload } from "lucide-react";

type ProfileDocument = { id: string; originalName: string; mimeType: string; sizeBytes: number; status: string; applicationId: string | null; draftId: string | null; createdAt: string };

export function ProfileDocuments({ initialDocuments }: { initialDocuments: ProfileDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  async function refresh() {
    const response = await fetch("/api/profile/documents", { credentials: "same-origin", headers: { accept: "application/json" } });
    const result = await response.json() as { documents?: ProfileDocument[] };
    if (response.ok) setDocuments(result.documents ?? []);
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/profile/documents", { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { accept: "application/json" } });
      const result = await response.json() as { documents?: ProfileDocument[]; message?: string };
      if (!response.ok) return setMessage(result.message ?? "Құжатты жүктеу мүмкін болмады.");
      setDocuments(result.documents ?? []);
      form.reset();
      setMessage("Құжат жеке профиліңізге сақталды.");
    } catch {
      setMessage("Құжатты жүктеу мүмкін болмады.");
    } finally {
      setUploading(false);
    }
  }
  async function remove(document: ProfileDocument) {
    if (!window.confirm(`${document.originalName} құжатын жоясыз ба?`)) return;
    setMessage("");
    const response = await fetch(`/api/profile/documents/${encodeURIComponent(document.id)}`, { method: "DELETE", credentials: "same-origin", headers: { accept: "application/json" } });
    const result = await response.json() as { message?: string };
    if (!response.ok) return setMessage(result.message ?? "Құжатты жою мүмкін болмады.");
    await refresh();
    setMessage("Құжат жойылды. Әрекет аудит тарихына жазылды.");
  }
  async function requestRemoval(document: ProfileDocument) {
    const reason = window.prompt("Құжатты не үшін жою керек?", "Қате құжат тіркелді");
    if (!reason) return;
    setMessage("");
    const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/removal-request`, {
      method: "POST", credentials: "same-origin", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ reason }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) return setMessage(result.message ?? "Жою сұрауын жіберу мүмкін болмады.");
    await refresh();
    setMessage("Жою сұрауы басшылыққа жіберілді.");
  }
  return <section className="panel profile-documents"><div className="panel-heading"><div><span><FileLock2 size={15} /> Жеке файлдар</span><h2>Менің құжаттарым</h2></div></div><p className="muted">PDF, JPG немесе PNG · 5 МБ-қа дейін. Құжаттар ашық жарияланбайды.</p><form onSubmit={upload}><input type="file" name="document" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /><button className="button button-secondary" type="submit" disabled={uploading}><Upload size={17} /> {uploading ? "Жүктелуде…" : "Құжат жүктеу"}</button></form>{message && <div className="form-alert" role="status">{message}</div>}<div className="document-list">{documents.map((document) => <div key={document.id}><span><FileLock2 size={18} /></span><div><strong>{document.originalName}</strong><small>{Math.ceil(document.sizeBytes / 1024)} КБ{document.status === "removal_requested" ? " · жою сұрауы қаралуда" : document.applicationId ? " · жіберілген өтініш құжаты" : document.draftId ? " · draft құжаты" : ""}</small></div><div className="document-actions"><a href={`/api/documents/${document.id}`}>Ашу</a>{document.status === "removal_requested" ? <span className="request-pending">Сұрау жіберілді</span> : document.applicationId ? <button type="button" onClick={() => void requestRemoval(document)}><Send size={14} /> Жоюды сұрау</button> : document.draftId ? <a href="/membership">Өтініштен басқару</a> : <button className="remove-document" type="button" onClick={() => void remove(document)}><Trash2 size={14} /> Жою</button>}</div></div>)}{documents.length === 0 && <p className="muted">Әзірге құжат жүктелмеген.</p>}</div></section>;
}
