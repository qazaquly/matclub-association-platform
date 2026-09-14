"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type StageDraft = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
};

function emptyStage(id: string): StageDraft {
  return { id, title: "", startDate: "", endDate: "", description: "" };
}

export function ProjectStageBatchForm({ projectId }: { projectId: string }) {
  const nextId = useRef(2);
  const [stages, setStages] = useState<StageDraft[]>([emptyStage("stage-1")]);

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((current) => current.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage));
  }

  function addStage() {
    if (stages.length >= 30) return;
    const id = `stage-${nextId.current}`;
    nextId.current += 1;
    setStages((current) => [...current, emptyStage(id)]);
  }

  function removeStage(index: number) {
    setStages((current) => current.filter((_, stageIndex) => stageIndex !== index));
  }

  const hasInvalidDates = stages.some((stage) => stage.startDate && stage.endDate && stage.endDate < stage.startDate);

  return <form action={`/api/projects/${projectId}/stages`} className="project-stage-batch" method="post">
    <input name="action" type="hidden" value="batch-add" />
    <div className="project-stage-batch-intro">
      <div><strong>Кезеңдерді бірден дайындаңыз</strong><p>Алдымен қажетті кезеңдердің бәрін енгізіңіз. Серверге соңында бір рет қана сақталады.</p></div>
      <span>{stages.length} кезең</span>
    </div>
    <div className="project-stage-draft-list">
      {stages.map((stage, index) => <fieldset key={stage.id}>
        <legend>{index + 1}-кезең</legend>
        <label className="stage-draft-title"><span>Кезең атауы *</span><input maxLength={240} name="title" onChange={(event) => updateStage(index, { title: event.target.value })} placeholder="Мысалы: Дайындық жұмысы" required value={stage.title} /></label>
        <label><span>Басталу күні</span><input name="startDate" onChange={(event) => updateStage(index, { startDate: event.target.value })} type="date" value={stage.startDate} /></label>
        <label><span>Аяқталу күні</span><input min={stage.startDate || undefined} name="endDate" onChange={(event) => updateStage(index, { endDate: event.target.value })} type="date" value={stage.endDate} /></label>
        <label className="stage-draft-description"><span>Қысқаша сипаттама</span><input maxLength={2000} name="description" onChange={(event) => updateStage(index, { description: event.target.value })} placeholder="Осы кезеңде не орындалады?" value={stage.description} /></label>
        {stages.length > 1 && <button aria-label={`${index + 1}-кезеңді алып тастау`} className="stage-draft-remove" onClick={() => removeStage(index)} type="button"><Trash2 size={15} /> Алып тастау</button>}
      </fieldset>)}
    </div>
    {hasInvalidDates && <p className="stage-draft-error">Аяқталу күні басталу күнінен ерте болмауы керек.</p>}
    <div className="project-stage-batch-actions">
      <button className="button" disabled={stages.length >= 30} onClick={addStage} type="button"><Plus size={15} /> Тағы кезең енгізу</button>
      <button className="button button-primary" disabled={hasInvalidDates} type="submit">Барлық кезеңді сақтау ({stages.length})</button>
    </div>
  </form>;
}
