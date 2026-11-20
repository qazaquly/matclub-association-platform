export type PublicContentFieldKind = "text" | "textarea" | "destination";

export interface PublicContentDefinition {
  key: string;
  section: string;
  label: string;
  kind: PublicContentFieldKind;
  defaultValue: string;
  maxLength: number;
}

export const publicContentDefinitions = [
  { key: "home.hero.headline", section: "Басты бет · кіріспе", label: "Негізгі тақырып", kind: "text", defaultValue: "Қазақстанның кәсіби математикалық қауымдастығы", maxLength: 140 },
  { key: "home.hero.slogan", section: "Басты бет · кіріспе", label: "Ұран", kind: "text", defaultValue: "Математика — ортақ тіл. Бірлестік — ортақ күш.", maxLength: 160 },
  { key: "home.hero.intro", section: "Басты бет · кіріспе", label: "Кіріспе мәтін", kind: "textarea", defaultValue: "Бірлестік Қазақстанның математика мұғалімдерін, оқытушыларын, ғалымдары мен әдіскерлерін біріктіреді.", maxLength: 600 },
  { key: "home.hero.primaryLabel", section: "Басты бет · кіріспе", label: "Негізгі батырма мәтіні", kind: "text", defaultValue: "Бірлестікке мүше болу", maxLength: 80 },
  { key: "home.hero.primaryDestination", section: "Басты бет · кіріспе", label: "Негізгі батырма сілтемесі", kind: "destination", defaultValue: "/membership", maxLength: 500 },
  { key: "home.hero.secondaryLabel", section: "Басты бет · кіріспе", label: "Қосымша батырма мәтіні", kind: "text", defaultValue: "Бірлестік туралы", maxLength: 80 },
  { key: "home.hero.secondaryDestination", section: "Басты бет · кіріспе", label: "Қосымша батырма сілтемесі", kind: "destination", defaultValue: "/about", maxLength: 500 },
  { key: "home.about.heading", section: "Басты бет · Бірлестік туралы", label: "Бөлім тақырыбы", kind: "textarea", defaultValue: "Бірлестік не істейді?", maxLength: 220 },
  { key: "home.about.intro", section: "Басты бет · Бірлестік туралы", label: "Бөлім мәтіні", kind: "textarea", defaultValue: "Мүшелер тәжірибе алмасады, ал өңірлік филиалдар жергілікті кездесулер мен жобаларды ұйымдастырады.", maxLength: 700 },
  { key: "home.structure.heading", section: "Басты бет · Құрылым", label: "Бөлім тақырыбы", kind: "textarea", defaultValue: "Бірлестікті кім басқарады?", maxLength: 180 },
  { key: "home.structure.intro", section: "Басты бет · Құрылым", label: "Бөлім мәтіні", kind: "textarea", defaultValue: "Президент пен вице-президенттер бірлестік жұмысын басқарады. Департаменттер кәсіби бағыттарға, ал филиалдар өз өңіріндегі жұмысқа жауап береді.", maxLength: 700 },
  { key: "home.structure.ctaLabel", section: "Басты бет · Құрылым", label: "Батырма мәтіні", kind: "text", defaultValue: "Ұйымдық құрылымды көру", maxLength: 80 },
  { key: "home.structure.ctaDestination", section: "Басты бет · Құрылым", label: "Батырма сілтемесі", kind: "destination", defaultValue: "/structure", maxLength: 500 },
  { key: "home.projects.heading", section: "Басты бет · Жобалар", label: "Бөлім тақырыбы", kind: "text", defaultValue: "Кездесулер мен материалдар", maxLength: 180 },
  { key: "home.projects.ctaLabel", section: "Басты бет · Жобалар", label: "Батырма мәтіні", kind: "text", defaultValue: "Барлық жобалар", maxLength: 80 },
  { key: "home.projects.ctaDestination", section: "Басты бет · Жобалар", label: "Батырма сілтемесі", kind: "destination", defaultValue: "/projects", maxLength: 500 },
  { key: "home.membership.heading", section: "Басты бет · Мүшелік", label: "Бөлім тақырыбы", kind: "textarea", defaultValue: "Бірлестікке қалай қосыламын?", maxLength: 220 },
  { key: "home.membership.intro", section: "Басты бет · Мүшелік", label: "Бөлім мәтіні", kind: "textarea", defaultValue: "Өтінішті онлайн жіберіңіз. Ол сіздің өңіріңіздегі филиалға автоматты түрде бағытталады.", maxLength: 600 },
  { key: "home.membership.ctaLabel", section: "Басты бет · Мүшелік", label: "Батырма мәтіні", kind: "text", defaultValue: "Өтініш беру", maxLength: 80 },
  { key: "home.membership.ctaDestination", section: "Басты бет · Мүшелік", label: "Батырма сілтемесі", kind: "destination", defaultValue: "/membership", maxLength: 500 },
  { key: "page.about.lead", section: "Ашық беттер", label: "«Бірлестік туралы» кіріспесі", kind: "textarea", defaultValue: "Бірлестікке Қазақстанның әр өңірінен математика мамандары қатысады.", maxLength: 700 },
  { key: "page.structure.lead", section: "Ашық беттер", label: "«Құрылым» кіріспесі", kind: "textarea", defaultValue: "Мұнда басшылардың міндеттерін көріп, өз өңіріңіздің филиалын таба аласыз.", maxLength: 700 },
  { key: "page.branches.lead", section: "Ашық беттер", label: "«Филиалдар» кіріспесі", kind: "textarea", defaultValue: "Филиалдар өз өңіріндегі мүшелік өтініштерге, кәсіби байланысқа және бірлестік жұмысына жауап береді.", maxLength: 700 },
  { key: "page.projects.lead", section: "Ашық беттер", label: "«Жобалар» кіріспесі", kind: "textarea", defaultValue: "Бірлестіктің жобалары мен бастамаларын осы жерден көре аласыз.", maxLength: 700 },
  { key: "page.news.lead", section: "Ашық беттер", label: "«Жаңалықтар» кіріспесі", kind: "textarea", defaultValue: "Бірлестік пен өңірлік филиалдардың жаңалықтары.", maxLength: 700 },
  { key: "common.cta.eyebrow", section: "Ашық беттер · ортақ шақыру", label: "Шақыру белгісі", kind: "text", defaultValue: "Бірлестік мүшесі болыңыз", maxLength: 100 },
  { key: "common.cta.heading", section: "Ашық беттер · ортақ шақыру", label: "Шақыру тақырыбы", kind: "text", defaultValue: "Мүшелікке өтініш беріңіз", maxLength: 180 },
  { key: "common.cta.label", section: "Ашық беттер · ортақ шақыру", label: "Батырма мәтіні", kind: "text", defaultValue: "Өтініш беру", maxLength: 80 },
  { key: "common.cta.destination", section: "Ашық беттер · ортақ шақыру", label: "Батырма сілтемесі", kind: "destination", defaultValue: "/membership", maxLength: 500 },
  { key: "contact.email", section: "Төменгі бөлік және байланыс", label: "Бірлестіктің байланыс поштасы", kind: "text", defaultValue: "", maxLength: 254 },
  { key: "contact.phone", section: "Төменгі бөлік және байланыс", label: "Бірлестіктің байланыс телефоны", kind: "text", defaultValue: "", maxLength: 40 },
  { key: "footer.description", section: "Төменгі бөлік және байланыс", label: "Бірлестік сипаттамасы", kind: "textarea", defaultValue: "Қазақстанның математика мамандарының бірлестігі.", maxLength: 500 },
  { key: "footer.contactLabel", section: "Төменгі бөлік және байланыс", label: "Байланыс сілтемесінің мәтіні", kind: "text", defaultValue: "Хабарласу", maxLength: 80 },
  { key: "footer.contactDestination", section: "Төменгі бөлік және байланыс", label: "Байланыс сілтемесі", kind: "destination", defaultValue: "/contact", maxLength: 500 },
] as const satisfies readonly PublicContentDefinition[];

export type PublicContentKey = (typeof publicContentDefinitions)[number]["key"];
export type PublicContentValues = Record<PublicContentKey, string>;

const definitionByKey = new Map<string, PublicContentDefinition>(publicContentDefinitions.map((definition) => [definition.key, definition]));

export function defaultPublicContent(): PublicContentValues {
  return Object.fromEntries(publicContentDefinitions.map((definition) => [definition.key, definition.defaultValue])) as PublicContentValues;
}

export function publicContentDefinition(key: string) {
  return definitionByKey.get(key);
}

export function validatePublicContentValue(key: string, rawValue: unknown) {
  const definition = publicContentDefinition(key);
  if (!definition || typeof rawValue !== "string") throw new Error("INVALID_CONTENT_FIELD");
  const value = rawValue.trim();
  if (key === "contact.email" || key === "contact.phone") {
    if (!value) return "";
    const valid = key === "contact.email" ? /^[^\s@<>:]+@[^\s@<>:]+\.[^\s@<>:]+$/u.test(value) : /^\+?[\d ()-]+$/.test(value) && /^(?:\D*\d){6,15}\D*$/.test(value);
    if (!valid || value.length > definition.maxLength) throw new Error("INVALID_CONTENT_VALUE");
    return value;
  }
  if (!value || value.length > definition.maxLength || /[<>]/.test(value) || value.includes(String.fromCharCode(0))) throw new Error("INVALID_CONTENT_VALUE");
  if (definition.kind === "destination") {
    if (value.startsWith("/") && !value.startsWith("//") && !/[\r\n]/.test(value)) return value;
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("INVALID_CONTENT_DESTINATION"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("INVALID_CONTENT_DESTINATION");
  }
  return value;
}

export const publicContentSeedRows = publicContentDefinitions.map((definition) => ({
  key: definition.key,
  section: definition.section,
  value: definition.defaultValue,
  valueType: definition.kind,
}));

// Older installations store the original seed copy in the database.
const previousPublicCopy: Partial<Record<PublicContentKey, string>> = {
  "home.hero.intro": "Ғалымдарды, оқытушыларды және математикалық ойлауды дамытатын мамандарды бір институционалдық кеңістікке біріктіреміз.",
  "home.about.heading": "Математиктерді бүгін біріктіріп, ертеңге мұра қалдырамыз.",
  "home.about.intro": "Бірлестік кәсіби байланысты күшейтеді, өңірлік бастамаларды қолдайды және математикалық қоғамның ұзақ мерзімді институционалдық жадын қалыптастырады.",
  "home.structure.heading": "Ортақ мақсат. Айқын жауапкершілік.",
  "home.structure.intro": "Президент, вице-президенттер, кәсіби департаменттер және өңірлік филиалдар бір басқару архитектурасында жұмыс істейді.",
  "home.projects.heading": "Бірлестік күн тәртібі",
  "home.membership.heading": "Кәсіби ортаға үлес қосатын кез келді.",
  "page.about.lead": "Республикалық математиктер бірлестігі мамандарды, өңірлерді және кәсіби бастамаларды ұзақ мерзімді негізде біріктіреді.",
  "page.structure.lead": "Бірлестік республикалық басқару, кәсіби департаменттер және өңірлік филиалдар қағидатымен құрылады.",
  "page.projects.lead": "Phase 1 жобалар мен бастамалардың ашық құрылымын ұсынады. Толық жобалық басқару кейінгі кезеңдерге жоспарланған.",
  "page.news.lead": "Республикалық басқару, департаменттер және өңірлік филиалдардан келетін ресми жаңалықтарға арналған бөлім.",
  "common.cta.heading": "Ортақ кәсіби кеңістікке қосылыңыз.",
  "footer.description": "Қазақстан математиктерін біріктіретін заманауи институционалдық кеңістік."
};

export function displayedContentValue(key: PublicContentKey, row: { value: string; updatedBy: string | null }) {
  return !row.updatedBy && previousPublicCopy[key] === row.value ? definitionByKey.get(key)!.defaultValue : row.value;
}
