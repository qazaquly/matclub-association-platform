import { ContentPage } from "@/app/components/ContentPage";
import { getPublicContentValues } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function StructurePage() {
  const content = await getPublicContentValues();
  return <ContentPage eyebrow="Ұйымдық құрылым" title="Кім неге жауап береді?" lead={content["page.structure.lead"]} blocks={[
    { title: "Президент және вице-президенттер", links: [{ label: "Президент", href: "/president" }, { label: "Вице-президенттер", href: "/vice-presidents" }], text: "Стратегиялық басқару, ұйымдық даму және кәсіби бағыттарды республикалық деңгейде үйлестіреді." },
    { title: "Департаменттер", links: [{ label: "Департаменттерді көру", href: "/departments" }], text: "Департаменттер математика материалдарын әзірлейді және мамандардың кәсіби дамуына көмектеседі." },
    { title: "Өңірлік филиалдар", links: [{ label: "Филиалды табу", href: "/branches" }], text: "Филиал өз өңірінен түскен өтініштерді қарап, мүшелермен жұмыс істейді." },
    { title: "Президенттің консультативтік кеңесі", text: "Ұйымдық құрылымда консультативтік орган ретінде қарастырылады. Қазіргі құрамы бекітілмегендіктен, ашық мүшелер тізімі жарияланбайды." },
  ]} />;
}
