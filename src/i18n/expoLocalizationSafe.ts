/**
 * Safe access to expo-localization when the dev client was built before the native
 * module was linked (requires `pod install` + native rebuild).
 */
export function getDeviceLanguageCode(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization") as {
      getLocales: () => { languageCode?: string | null }[];
    };
    return getLocales()[0]?.languageCode ?? undefined;
  } catch {
    return undefined;
  }
}
