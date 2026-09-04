import { en, type Translations } from "./en";
import { km } from "./km";

export type Locale = "en" | "km";

export const translations: Record<Locale, Translations> = {
  en,
  km,
};

export function getTranslation(locale: Locale): Translations {
  return translations[locale] ?? translations.en;
}

export type { Translations };
