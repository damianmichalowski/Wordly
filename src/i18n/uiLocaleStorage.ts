import AsyncStorage from "@react-native-async-storage/async-storage";

import { storageKeys } from "@/src/constants/storageKeys";
import type { AppLocale } from "@/src/i18n/types";
import { isAppLocale } from "@/src/i18n/types";

export async function getCachedAppLocale(): Promise<AppLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKeys.appUiLocale);
    if (raw && isAppLocale(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setCachedAppLocale(locale: AppLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.appUiLocale, locale);
  } catch {
    /* ignore */
  }
}
