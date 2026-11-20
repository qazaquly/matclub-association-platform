import { ContentPage } from "@/app/components/ContentPage";
import { getPublicContentValues } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function StructurePage() {
  const content = await getPublicContentValues();
  return <ContentPage eyebrow="Ұйымдық құрылым" title="Өкілеттік пен жауапкершіліктің айқын жүйесі" lead={content["page.structure.lead"]} blocks={[
    { title: "Президент және вице-президенттер", links: [{ label: "Президент", href: "/president" }, { label: "Вице-президенттер", href: "/vice-presidents" }], text: "Стратегиялық басқару, ұйымдық даму және кәсіби бағыттарды республикалық деңгейде үйлестіреді." },
    { title: "Департаменттер", links: [{ label: "Департаменттерді көру", href: "/departments" }], text: "Математика, мазмұн және кәсіби даму міндеттері бойынша шектеулі, мақсатқа сай деректермен жұмыс істейді." },
    { title: "Өңірлік филиалдар", links: [{ label: "Филиалды табу", href: "/branches" }], text: "Өз өңіріндегі өтініштер мен мүшелік операцияларды жүргізеді. Басқа өңірлердің немесе орталықтың шектеулі деректеріне қол жеткізбейді." },
    { title: "Президенттің консультативтік кеңесі", text: "Ұйымдық құрылымда консультативтік орган ретінде қарастырылады. Қазіргі құрамы бекітілмегендіктен, ашық мүшелер тізімі жарияланбайды." },
  ]} />;
}
