/* eslint-disable @next/next/no-img-element -- Images come from the audited public-media route and have no static dimensions. */
import type { DynamicContentKind } from "@/lib/dynamic-content";

interface FormItem {
  title?: string;
  name?: string;
  slug?: string;
  lead?: string;
  summary?: string;
  description?: string;
  body?: string;
  authorText?: string | null;
  publicationDate?: Date | null;
  resourceUrl?: string | null;
  websiteUrl?: string | null;
  displayOrder?: number;
  publicStartDate?: Date | null;
  publicEndDate?: Date | null;
  coverMediaId?: string | null;
  logoMediaId?: string | null;
}

function dateValue(value?: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export function DynamicContentForm({ kind, item, action, submitLabel }: { kind: DynamicContentKind; item?: FormItem | null; action: string; submitLabel: string }) {
  const mediaId = item?.coverMediaId ?? item?.logoMediaId;
  return <form className="dynamic-content-form" action={action} method="post" encType="multipart/form-data">
    {kind === "partners" ? <>
      <label><span>Серіктес атауы</span><input name="name" defaultValue={item?.name ?? ""} required maxLength={180} /></label>
      <label><span>Сайт сілтемесі</span><input name="websiteUrl" defaultValue={item?.websiteUrl ?? ""} type="url" maxLength={1000} placeholder="https://" /></label>
      <label className="content-field-wide"><span>Қысқаша сипаттама</span><textarea name="description" defaultValue={item?.description ?? ""} required maxLength={1000} rows={4} /></label>
      <label><span>Көрсетілу реті</span><input name="displayOrder" defaultValue={item?.displayOrder ?? 0} type="number" min={-10000} max={10000} /></label>
    </> : <>
      <label><span>Атауы</span><input name="title" defaultValue={item?.title ?? ""} required maxLength={220} /></label>
      <label><span>Тұрақты сілтеме</span><input name="slug" defaultValue={item?.slug ?? ""} maxLength={120} placeholder="Бос қалса, атаудан жасалады" /></label>
      <label className="content-field-wide"><span>{kind === "news" ? "Лид" : "Қысқаша сипаттама"}</span><textarea name="summary" defaultValue={item?.lead ?? item?.summary ?? ""} required maxLength={700} rows={3} /></label>
      <label className="content-field-wide"><span>Негізгі мәтін</span><textarea name="body" defaultValue={item?.body ?? ""} required maxLength={30000} rows={14} /></label>
      <small className="markdown-help content-field-wide">Қауіпсіз Markdown: ## тақырып, - тізім, **қалың мәтін**, [сілтеме](https://...). HTML және JavaScript орындалмайды.</small>
      {(kind === "news" || kind === "publications") && <label><span>Автор мәтіні</span><input name="authorText" defaultValue={item?.authorText ?? ""} maxLength={220} /></label>}
      {kind === "publications" && <>
        <label><span>Жарияланым күні</span><input name="publicationDate" defaultValue={dateValue(item?.publicationDate)} type="date" /></label>
        <label className="content-field-wide"><span>Файл немесе сыртқы сілтеме</span><input name="resourceUrl" defaultValue={item?.resourceUrl ?? ""} maxLength={1000} placeholder="/ішкі-жол немесе https://" /></label>
      </>}
      {kind === "projects" && <>
        <label><span>Көрсетілу реті</span><input name="displayOrder" defaultValue={item?.displayOrder ?? 0} type="number" min={-10000} max={10000} /></label>
        <label><span>Басталу күні</span><input name="publicStartDate" defaultValue={dateValue(item?.publicStartDate)} type="date" /></label>
        <label><span>Аяқталу күні</span><input name="publicEndDate" defaultValue={dateValue(item?.publicEndDate)} type="date" /></label>
      </>}
    </>}
    <label className="content-field-wide"><span>{kind === "partners" ? "Логотип" : "Мұқаба суреті"}</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><small>JPG, PNG, WebP немесе AVIF · 8 МБ-қа дейін</small></label>
    {mediaId && <div className="current-media content-field-wide"><img src={`/api/public-media/${mediaId}`} alt="Қазіргі сурет" /><label><input name="removeImage" type="checkbox" /> Суретті алып тастау</label></div>}
    <button className="button button-primary content-field-wide" name="action" value="save" type="submit">{submitLabel}</button>
  </form>;
}
