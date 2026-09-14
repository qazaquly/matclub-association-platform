export const supportedLocales = ["kk", "ru", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const defaultLocale: SupportedLocale = "kk";

const kk = {
  association: "Бірлестік",
  structure: "Құрылым",
  branches: "Филиалдар",
  projects: "Жобалар",
  news: "Жаңалықтар",
  signIn: "Кіру",
  becomeMember: "Мүше болу",
} as const;

export type TranslationKey = keyof typeof kk;

// Russian and English dictionaries can be added here without changing domain,
// authorization, workflow, or persistence modules. Missing keys safely fall
// back to the primary Kazakh dictionary.
const dictionaries: Record<SupportedLocale, Partial<Record<TranslationKey, string>>> = {
  kk,
  ru: {},
  en: {},
};

export function translate(locale: SupportedLocale, key: TranslationKey) {
  return dictionaries[locale][key] ?? kk[key];
}
