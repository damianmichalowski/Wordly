import type { AppLocale } from "@/src/i18n/types";

/**
 * Maps BCP-47 / ISO codes to app UI locale. Unknown → English.
 */
export function normalizeToAppLocale(languageCode: string | null | undefined): AppLocale {
  if (!languageCode) {
    return "en";
  }
  const lower = languageCode.toLowerCase();
  if (lower === "pl" || lower.startsWith("pl-")) {
    return "pl";
  }
  return "en";
}
