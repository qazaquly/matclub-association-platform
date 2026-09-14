import type { Metadata } from "next";
import { PublicShell } from "@/app/components/PublicShell";

export const metadata: Metadata = { title: "Дербес деректерді өңдеу тәртібі" };

export default function PrivacyPage() {
  return <PublicShell><main className="legal-page"><section className="container"><p className="eyebrow dark">Нұсқа 2026.1</p><h1>Дербес деректерді өңдеу тәртібі</h1><p>Мүшелікке өтініште берілген деректер тіркелгіні жүргізу, өтінішті өңірлік филиалға бағыттау, мүшелік туралы шешім қабылдау және бір адамның үздіксіз институционалдық тарихын сақтау үшін өңделеді.</p><p>Жүктелген құжаттар ашық жарияланбайды. Оларды иесі және қолданыстағы рөлдер мен жауапкершілік аумағына сәйкес уәкілетті қызметкерлер ғана көре алады.</p><p>Өтініш жіберілген кезде келісім уақыты мен осы тәртіптің нұсқасы өтінішке тіркеледі.</p></section></main></PublicShell>;
}
