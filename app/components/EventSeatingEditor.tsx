"use client";

import { ArrowDown, ArrowUp, Armchair, Grid3X3, Plus, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

type SeatingType = "NONE" | "ROWS" | "TABLES" | "FREE";
type SeatingUnit = { id: string; label: string; seatCount: number };
type OccupiedSeat = {
  registrationId: string;
  fullName: string;
  seatingUnitId: string;
  seatNumber: number;
  present: boolean;
};

const typeOptions: Array<{ value: SeatingType; title: string; description: string; icon: "none" | "rows" | "tables" | "free" }> = [
  { value: "NONE", title: "Орын бөлінбейді", description: "Орын туралы дерек қажет емес", icon: "none" },
  { value: "ROWS", title: "Қатарлы зал", description: "Театр немесе конференция", icon: "rows" },
  { value: "TABLES", title: "Үстелдер", description: "Банкет немесе топтық жұмыс", icon: "tables" },
  { value: "FREE", title: "Еркін отыру", description: "Қатысушы бос орынды өзі таңдайды", icon: "free" },
];

function TypeIcon({ type }: { type: "none" | "rows" | "tables" | "free" }) {
  if (type === "rows") return <Armchair size={22} />;
  if (type === "tables") return <Grid3X3 size={22} />;
  if (type === "free") return <UsersRound size={22} />;
  return <span className="seating-none-icon">—</span>;
}

function nextLabel(type: SeatingType, units: SeatingUnit[]) {
  const used = new Set(units.map((unit) => unit.label.trim().toLocaleLowerCase("kk-KZ")));
  if (type === "TABLES") {
    for (let number = 1; number <= 99; number += 1) if (!used.has(String(number))) return String(number);
  }
  for (let code = 65; code <= 90; code += 1) {
    const candidate = String.fromCharCode(code);
    if (!used.has(candidate.toLocaleLowerCase("kk-KZ"))) return candidate;
  }
  return String(units.length + 1);
}

export function EventSeatingEditor({
  eventId,
  initialType,
  initialUnits,
  occupiedSeats,
}: {
  eventId: string;
  initialType: string;
  initialUnits: SeatingUnit[];
  occupiedSeats: OccupiedSeat[];
}) {
  const safeInitialType = typeOptions.some((option) => option.value === initialType) ? initialType as SeatingType : "NONE";
  const [seatingType, setSeatingType] = useState<SeatingType>(safeInitialType);
  const [units, setUnits] = useState<SeatingUnit[]>(() => initialUnits.length > 0 ? initialUnits : (
    safeInitialType === "TABLES" ? [{ id: "new-initial-table", label: "1", seatCount: 10 }]
      : safeInitialType === "ROWS" ? [{ id: "new-initial-row", label: "A", seatCount: 20 }]
        : []
  ));
  const usesNumberedSeats = seatingType === "ROWS" || seatingType === "TABLES";
  const unitTitle = seatingType === "TABLES" ? "Үстел" : "Қатар";
  const unitTitleLower = seatingType === "TABLES" ? "үстел" : "қатар";
  const capacity = units.reduce((sum, unit) => sum + (Number.isFinite(unit.seatCount) ? unit.seatCount : 0), 0);
  const normalizedLabels = units.map((unit) => unit.label.trim().toLocaleLowerCase("kk-KZ"));
  const hasInvalidUnits = usesNumberedSeats && (
    units.length === 0
    || units.some((unit) => !unit.label.trim() || unit.label.includes(":") || unit.label.trim().length > 12 || !Number.isSafeInteger(unit.seatCount) || unit.seatCount < 1 || unit.seatCount > 200)
    || new Set(normalizedLabels).size !== normalizedLabels.length
  );
  const layout = units.map((unit) => `${unit.label.trim()}:${unit.seatCount}`).join("\n");
  const occupiedByUnit = useMemo(() => {
    const map = new Map<string, Map<number, OccupiedSeat>>();
    for (const seat of occupiedSeats) {
      const unit = map.get(seat.seatingUnitId) ?? new Map<number, OccupiedSeat>();
      unit.set(seat.seatNumber, seat);
      map.set(seat.seatingUnitId, unit);
    }
    return map;
  }, [occupiedSeats]);

  function chooseType(type: SeatingType) {
    setSeatingType(type);
    if ((type === "ROWS" || type === "TABLES") && units.length === 0) {
      setUnits([{ id: `new-${crypto.randomUUID()}`, label: type === "TABLES" ? "1" : "A", seatCount: type === "TABLES" ? 10 : 20 }]);
    }
  }

  function updateUnit(index: number, patch: Partial<SeatingUnit>) {
    setUnits((current) => current.map((unit, unitIndex) => unitIndex === index ? { ...unit, ...patch } : unit));
  }

  function moveUnit(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= units.length) return;
    setUnits((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addUnit() {
    if (units.length >= 30) return;
    setUnits((current) => [...current, {
      id: `new-${crypto.randomUUID()}`,
      label: nextLabel(seatingType, current),
      seatCount: seatingType === "TABLES" ? 10 : 20,
    }]);
  }

  function applyTableTemplate() {
    setSeatingType("TABLES");
    setUnits(Array.from({ length: 10 }, (_, index) => ({
      id: `new-${crypto.randomUUID()}`,
      label: String(index + 1),
      seatCount: 10,
    })));
  }

  return <section className="panel seating-panel seating-editor">
    <div className="panel-heading"><div><span>Зал мен орындар</span><h2>Отыру үлгісі</h2></div>{usesNumberedSeats && <strong className="seating-capacity">{units.length} {unitTitleLower} · {capacity} орын</strong>}</div>
    <form action={`/api/events/${eventId}/seating`} method="post">
      <input name="seatingType" type="hidden" value={seatingType} />
      <input name="layout" type="hidden" value={usesNumberedSeats ? layout : ""} />

      <div className="seating-type-picker">
        {typeOptions.map((option) => <button className={seatingType === option.value ? "active" : ""} key={option.value} onClick={() => chooseType(option.value)} type="button">
          <TypeIcon type={option.icon} /><span><b>{option.title}</b><small>{option.description}</small></span>
        </button>)}
      </div>

      {usesNumberedSeats && <>
        <div className="seating-editor-heading">
          <div><h3>{unitTitle}лер мен орындар</h3><p>{unitTitle} атауын өзіңіз қоясыз: мысалы, <b>{seatingType === "TABLES" ? "1, 2, VIP" : "A, B немесе 1, 2"}</b>.</p></div>
          {seatingType === "TABLES" && <button className="button" onClick={applyTableTemplate} type="button">10 үстел үлгісі</button>}
        </div>
        <div className="seating-unit-editor-list">
          {units.map((unit, index) => <div className="seating-unit-editor" key={unit.id}>
            <span className="seating-unit-order">{index + 1}</span>
            <label><span>{unitTitle} атауы</span><input aria-label={`${index + 1}-${unitTitleLower} атауы`} maxLength={12} required value={unit.label} onChange={(event) => updateUnit(index, { label: event.target.value })} /></label>
            <label><span>Орын саны</span><input aria-label={`${unit.label || index + 1} орын саны`} max={200} min={1} required type="number" value={unit.seatCount} onChange={(event) => updateUnit(index, { seatCount: Number(event.target.value) })} /></label>
            <div className="seating-unit-actions">
              <button aria-label="Жоғары жылжыту" disabled={index === 0} onClick={() => moveUnit(index, -1)} type="button"><ArrowUp size={15} /></button>
              <button aria-label="Төмен жылжыту" disabled={index === units.length - 1} onClick={() => moveUnit(index, 1)} type="button"><ArrowDown size={15} /></button>
              <button aria-label="Өшіру" className="danger" disabled={units.length === 1} onClick={() => setUnits((current) => current.filter((_, unitIndex) => unitIndex !== index))} type="button"><Trash2 size={15} /></button>
            </div>
          </div>)}
        </div>
        <button className="add-seating-unit" disabled={units.length >= 30} onClick={addUnit} type="button"><Plus size={16} /> {unitTitle} қосу</button>
        {hasInvalidUnits && <p className="seating-validation">Атаулар бос немесе қайталанған болмауы керек. Бір {unitTitleLower}де 1–200 орын болуы мүмкін.</p>}

        <div className={`seating-preview ${seatingType === "TABLES" ? "tables" : "rows"}`}>
          <div className="seating-preview-heading"><span>Көрнекі сызба</span><small><i /> Бос <i className="assigned" /> Бекітілген <i className="present" /> Келді</small></div>
          {seatingType === "ROWS" && <div className="seating-stage">САХНА</div>}
          <div className="seating-preview-grid">
            {units.map((unit) => <article key={unit.id}>
              <strong>{seatingType === "TABLES" ? `${unit.label || "?"}-үстел` : `${unit.label || "?"} қатары`}</strong>
              <div>{Array.from({ length: Math.min(Math.max(unit.seatCount || 0, 0), 200) }, (_, seatIndex) => {
                const number = seatIndex + 1;
                const occupant = occupiedByUnit.get(unit.id)?.get(number);
                return <span className={occupant?.present ? "present" : occupant ? "assigned" : ""} key={number} title={occupant ? `${number}-орын · ${occupant.fullName}` : `${number}-орын · бос`}>{number}</span>;
              })}</div>
            </article>)}
          </div>
        </div>
      </>}

      {!usesNumberedSeats && <div className="seating-simple-state"><TypeIcon type={seatingType === "FREE" ? "free" : "none"} /><div><b>{seatingType === "FREE" ? "Қатысушылар еркін отырады" : "Орын дерегі жүргізілмейді"}</b><span>{seatingType === "FREE" ? "Нақты үстел мен орын нөмірі бекітілмейді." : "Тек тіркелу мен қатысу мәртебесі сақталады."}</span></div></div>}

      {occupiedSeats.length > 0 && <div className="seating-reset-warning"><input id="reset-seat-assignments" name="resetAssignments" type="checkbox" /><label htmlFor="reset-seat-assignments"><b>Сызбаны өзгертсем, бұрын берілген {occupiedSeats.length} орынды босатуға келісемін.</b><small>Қатысушылардың тіркелуі мен қатысу белгісі өшпейді.</small></label></div>}
      <div className="seating-save-row"><button className="button button-primary" disabled={hasInvalidUnits} type="submit">Сызбаны сақтау</button></div>
    </form>
  </section>;
}
