import type { ImageSourcePropType } from "react-native";

import { FLAG_IMAGES } from "@/assets/flags";

/**
 * Język (ISO 639-1) → kraj dla pliku w `assets/flags` (ISO 3166-1 alpha-2).
 * English → gb itd.
 */
export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: "gb",
  pl: "pl",
  de: "de",
  es: "es",
  it: "it",
  hi: "in",
  pt: "pt",
  tr: "tr",
  fr: "fr",
  ru: "ru",
  uk: "ua",
  cs: "cz",
  sk: "sk",
  nl: "nl",
  sv: "se",
  no: "no",
  da: "dk",
  fi: "fi",
  el: "gr",
  ro: "ro",
  hu: "hu",
  ja: "jp",
  ko: "kr",
  zh: "cn",
};

function iso639Part1FromCode(code: string): string {
  const raw = code.trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const first = raw.split(/[-_]/)[0] ?? "";
  if (!first) {
    return "";
  }
  if (first.length === 2) {
    return first;
  }
  if (first.length >= 3) {
    try {
      const lang = new Intl.Locale(first).language;
      if (typeof lang === "string" && lang.length === 2) {
        return lang;
      }
    } catch {
      /* Hermes / starsze środowiska */
    }
  }
  return first.slice(0, 2);
}

export function languageToFlagCountryCode(languageCode: string): string | null {
  const key = iso639Part1FromCode(languageCode);
  if (key.length < 2) {
    return null;
  }
  const two = key.slice(0, 2);
  return LANGUAGE_TO_COUNTRY[two] ?? null;
}

export function getLocalFlagSource(
  countryCode: string,
): ImageSourcePropType | null {
  const key = countryCode.trim().toLowerCase();
  return FLAG_IMAGES[key] ?? null;
}
