/** Supported app UI languages (expand with new locale files + DB check). */
export type AppLocale = "en" | "pl";

export const APP_LOCALES: readonly AppLocale[] = ["en", "pl"] as const;

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "pl";
}
