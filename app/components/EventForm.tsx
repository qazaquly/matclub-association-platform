"use client";
/* eslint-disable @next/next/no-img-element -- Event covers use the audited public-media route. */
import { PersonSelect } from "@/app/components/PersonSelect";

import { useState } from "react";
import { dateTimeLocalValue } from "@/lib/events";

interface EventFormItem {
  title: string;
  slug: string;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  eventScope: string;
  branchId: string | null;
  regionName: string | null;
  venue: string | null;
  eventFormat: string;
  onlineUrl: string | null;
  audience: string;
  organizer: string;
  responsibleProfileId: string | null;
  responsibleDepartmentId: string | null;
  registrationMode: string;
  externalRegistrationUrl: string | null;
  participantLimit: number | null;
  seatingType: string;
  coverMediaId: string | null;
}

interface EventFormOptions {
  branches: { id: string; regionName: string }[];
  people: { id: string; fullName: string; branchId: string | null }[];
  departments: { id: string; nameKk: string }[];
}

export function EventForm({
  action, item, options, canChooseNational, canManageMedia, submitLabel, canPublish = false,
}: {
  action: string;
  item?: EventFormItem | null;
  options: EventFormOptions;
  canChooseNational: boolean;
  canManageMedia: boolean;
  submitLabel: string;
  canPublish?: boolean;
}) {
  const defaultScope = item?.eventScope ?? (canChooseNational ? "NATIONAL" : "BRANCH");
  const [scope, setScope] = useState(defaultScope);
  const [format, setFormat] = useState(item?.eventFormat ?? "OFFLINE");
  const [registration, setRegistration] = useState(item?.registrationMode ?? "NONE");
  return <form className="event-form" action={action} method="post" encType="multipart/form-data">
    <label><span>Іс-шара атауы</span><input name="title" defaultValue={item?.title ?? ""} required maxLength={220} /></label>
    <label><span>Тұрақты сілтеме</span><input name="slug" defaultValue={item?.slug ?? ""} maxLength={120} placeholder="Бос қалса, атаудан жасалады" /></label>
    <label className="content-field-wide"><span>Қысқаша сипаттама</span><textarea name="summary" defaultValue={item?.summary ?? ""} required maxLength={700} rows={3} /></label>
    <label className="content-field-wide"><span>Толық сипаттама</span><textarea name="description" defaultValue={item?.description ?? ""} required maxLength={30000} rows={10} /></label>


    <label><span>Басталу уақыты (Астана)</span><input name="startAt" type="datetime-local" defaultValue={dateTimeLocalValue(item?.startAt)} required /></label>
    <label><span>Аяқталу уақыты (Астана)</span><input name="endAt" type="datetime-local" defaultValue={dateTimeLocalValue(item?.endAt)} required /></label>

    {canChooseNational ? <label><span>Деңгейі</span><select name="eventScope" value={scope} onChange={e => setScope(e.target.value)}><option value="NATIONAL">Республикалық</option><option value="BRANCH">Филиалдық</option></select></label>
      : <><input type="hidden" name="eventScope" value="BRANCH" /><label><span>Деңгейі</span><input value="Филиалдық" readOnly /></label></>}
    {scope === "BRANCH" && <label><span>Филиал</span><select name="branchId" required defaultValue={item?.branchId ?? (options.branches.length === 1 ? options.branches[0].id : "")}><option value="">Филиалды таңдаңыз</option>{options.branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.regionName}</option>)}</select></label>}
    <label><span>Өңір немесе қала</span><input name="regionName" defaultValue={item?.regionName ?? ""} maxLength={180} /></label>
    <label><span>Форматы</span><select name="eventFormat" value={format} onChange={e => setFormat(e.target.value)}><option value="OFFLINE">Офлайн</option><option value="ONLINE">Онлайн</option><option value="HYBRID">Аралас</option></select></label>
    {format !== "ONLINE" && <label><span>Өтетін жері</span><input name="venue" required defaultValue={item?.venue ?? ""} maxLength={500} /></label>}
    {format !== "OFFLINE" && <label><span>Онлайн сілтеме</span><input name="onlineUrl" required defaultValue={item?.onlineUrl ?? ""} type="url" maxLength={1000} placeholder="https://" /></label>}
    <label className="content-field-wide"><span>Кімдерге арналған</span><textarea name="audience" defaultValue={item?.audience ?? ""} required maxLength={1000} rows={3} /></label>
    <label><span>Ұйымдастырушы</span><input name="organizer" defaultValue={item?.organizer ?? ""} required maxLength={500} /></label>
    <PersonSelect people={options.people} name="responsibleProfileId" label="Жауапты адам" placeholder="Таңдалмаған" defaultId={item?.responsibleProfileId ?? ""} />
    <label><span>Жауапты бөлім</span><select name="responsibleDepartmentId" defaultValue={item?.responsibleDepartmentId ?? ""}><option value="">Таңдалмаған</option>{options.departments.map((department) => <option value={department.id} key={department.id}>{department.nameKk}</option>)}</select></label>

    <label><span>Тіркелу тәртібі</span><select name="registrationMode" value={registration} onChange={e => setRegistration(e.target.value)}><option value="NONE">Тіркелусіз</option><option value="EXTERNAL_LINK">Сыртқы сілтеме</option><option value="INTERNAL_MEMBERS">Мүшелер үшін ішкі тіркелу</option></select></label>
    {registration === "EXTERNAL_LINK" && <label><span>Сыртқы тіркелу сілтемесі</span><input name="externalRegistrationUrl" required defaultValue={item?.externalRegistrationUrl ?? ""} type="url" maxLength={1000} placeholder="https://" /></label>}
    {registration === "INTERNAL_MEMBERS" && <label><span>Қатысушы шегі</span><input name="participantLimit" defaultValue={item?.participantLimit ?? ""} type="number" min={1} max={1000000} /></label>}
    <label><span>Орын тәртібі</span><select name="seatingType" defaultValue={item?.seatingType ?? "NONE"}><option value="NONE">Орын бөлінбейді</option><option value="ROWS">Қатарлар</option><option value="TABLES">Үстелдер</option><option value="FREE">Еркін отыру</option></select></label>

    {canManageMedia && <label className="content-field-wide"><span>Мұқаба суреті</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><small>JPG, PNG, WebP немесе AVIF · 8 МБ-қа дейін</small></label>}
    {item?.coverMediaId && <div className="current-media content-field-wide"><img src={`/api/public-media/${item.coverMediaId}`} alt="Іс-шара мұқабасы" />{canManageMedia && <label><input name="removeImage" type="checkbox" /> Суретті алып тастау</label>}</div>}
    <div className="editor-actions content-field-wide">
      <button className={item ? "button button-primary" : "button"} name="action" value="save" type="submit">{submitLabel}</button>
      {!item && <button className="button button-primary" name="action" value={canPublish ? "publish" : "submit"}>{canPublish ? "Сайтқа жариялау" : "Қарауға жіберу"}</button>}
    </div>
  </form>;
}
