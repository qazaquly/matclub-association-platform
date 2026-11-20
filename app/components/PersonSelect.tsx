"use client";

import { useState } from "react";

type PersonOption = { id: string; fullName: string; branch?: { regionName: string } | null };
const batchSize = 50;

export function PersonSelect({ people, name, label, placeholder, defaultId = "", required = false }: {
  people: PersonOption[]; name: string; label: string; placeholder: string; defaultId?: string; required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(batchSize);
  const [selected, setSelected] = useState(defaultId);
  const needle = query.trim().toLocaleLowerCase("kk-KZ");
  const matches = needle ? people.filter(person => [person.fullName, person.branch?.regionName].some(value => value?.toLocaleLowerCase("kk-KZ").includes(needle))) : people;
  const shown = matches.slice(0, limit);
  const current = selected && !shown.some(person => person.id === selected) ? people.find(person => person.id === selected) : null;
  return <div className="person-select">
    {people.length > batchSize && <label><span>{label} · іздеу</span><input type="search" value={query} placeholder="Аты-жөнін жазыңыз" onChange={event => { setQuery(event.target.value); setLimit(batchSize); }} /></label>}
    <label><span>{label}</span><select name={name} value={selected} onChange={event => setSelected(event.target.value)} required={required}>
      <option value="" disabled={required}>{placeholder}</option>
      {(current ? [current, ...shown] : shown).map(person => <option key={person.id} value={person.id}>{person.fullName}{person.branch && ` · ${person.branch.regionName}`}</option>)}
    </select></label>
    {people.length > batchSize && <small role="status">{matches.length ? `${shown.length} / ${matches.length} адам` : "Адам табылмады"}</small>}
    {matches.length > limit && <button type="button" onClick={() => setLimit(limit + batchSize)}>Келесі {Math.min(batchSize, matches.length - limit)} адамды көрсету</button>}
  </div>;
}
