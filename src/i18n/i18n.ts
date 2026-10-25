import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/src/i18n/locales/en";
import pl from "@/src/i18n/locales/pl";
import { getDeviceLanguageCode } from "@/src/i18n/expoLocalizationSafe";
import { normalizeToAppLocale } from "@/src/i18n/resolveLocale";
import type { AppLocale } from "@/src/i18n/types";

const initialLng: AppLocale = normalizeToAppLocale(getDeviceLanguageCode());

export const i18n = createInstance();

/** Await in bootstrap before hiding splash — ensures strings are ready + profile locale applied. */
export const i18nInitPromise = i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: initialLng,
  fallbackLng: "en",
  supportedLngs: ["en", "pl"],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

/** Apply locale after profile / cache (still before isReady / splash hide). */
export async function applyAppLocale(locale: AppLocale): Promise<void> {
  if (i18n.language === locale) {
    return;
  }
  await i18n.changeLanguage(locale);
}
