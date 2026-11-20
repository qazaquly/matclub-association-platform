/* eslint-disable @next/next/no-html-link-for-pages -- Keep navigation to the cabinet server-rendered. */
import { PublicShell } from "@/app/components/PublicShell";
import { getPublicContentValues } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { canManagePublicContent } from "@/lib/authorization";

export default async function ContactPage() {
  const [content, user] = await Promise.all([getPublicContentValues(), getCurrentUser()]);
  const email = content["contact.email"];
  const phone = content["contact.phone"];
  return <PublicShell content={content}><main>
    <section className="page-hero"><div className="container narrow"><h1>Байланыс</h1></div></section>
    <section className="section container narrow"><div className="contact-note">
      {email && <p>Электрондық пошта <a href={`mailto:${email}`}>{email}</a></p>}
      {phone && <p>Телефон <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></p>}
      {!email && !phone && <p>Бірлестіктің байланыс деректері әзірге жарияланған жоқ.</p>}
      {user && canManagePublicContent(user) && <a className="button" href="/dashboard/content?view=text#contact.email">Байланыс деректерін өңдеу</a>}
    </div></section>
  </main></PublicShell>;
}
