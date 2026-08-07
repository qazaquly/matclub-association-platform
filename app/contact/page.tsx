import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { PublicShell } from "@/app/components/PublicShell";

export default function ContactPage() {
  return <PublicShell><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">Байланыс</p><h1>Сұрағыңызды дұрыс бағытқа жеткізейік</h1><p>Мүшелік мәселелері бойынша өтініш өңірлік филиалға автоматты түрде түседі. Жалпы сауалдар үшін республикалық кеңсеге хабарласыңыз.</p></div></section><section className="section container narrow"><div className="contact-grid"><article><Mail /><span>Электрондық пошта</span><a href="mailto:office@ramk.example.kz">office@ramk.example.kz</a></article><article><Phone /><span>Қабылдау</span><a href="tel:+77172000000">+7 7172 00 00 00</a></article><article><MapPin /><span>Республикалық кеңсе</span><p>Астана қаласы, Қазақстан</p></article></div><div className="contact-note"><h2>Мүшелікке өтініш бергіңіз келе ме?</h2><p>Арнайы нысанды толтырсаңыз, деректеріңіз өңіріңізге қарай автоматты бағытталады.</p><Link className="button button-primary" href="/membership">Өтініш нысанын ашу</Link></div></section></main></PublicShell>;
}
