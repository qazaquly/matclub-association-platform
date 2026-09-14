import { ContentPage } from "@/app/components/ContentPage";
import { getPublicContentValues } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const content = await getPublicContentValues();
  return <ContentPage eyebrow="Бірлестік туралы" title="Математикалық қоғамның тұрақты кәсіби институты" lead={content["page.about.lead"]} blocks={[
    { title: "Біздің рөліміз", text: "Бірлестік кәсіби байланысты нығайтып, ортақ бастамаларды үйлестіреді және математикалық қоғамның институционалдық жадын сақтайды." },
    { title: "Жұмыс қағидаты", text: "Ашықтық, кәсіби жауапкершілік, өңірлік теңдік және деректерге ұқыпты қарау — басқару жүйесінің өзегі." },
    { title: "Кімдерді біріктіреміз", text: "Ғалымдар, жоғары оқу орны оқытушылары, математика мұғалімдері, әдіскерлер және кәсіби математикалық ортаға үлес қосатын мамандар." },
  ]} />;
}
