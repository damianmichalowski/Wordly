import { storageKeys } from "@/src/constants/storageKeys";
import * as kv from "@/src/services/storage/kvStorage";
import type { DailyWordSnapshot } from "@/src/types/dailyWord";
import type { UserProfile } from "@/src/types/profile";

import { getLocalCalendarDateKey } from "@/src/utils/calendarDate";
import { LogTag, logger } from "@/src/utils/logger";

export function buildCurrentWordProfileKey(profile: UserProfile): string {
  const p = profile.languagePair;
  return `${profile.userId}|${profile.displayLevel}|${p.sourceLanguage}|${p.targetLanguage}`;
}

export type CachedCurrentWordPayload = {
  /** Same as `getLocalCalendarDateKey()` when written. */
  dateKey: string;
  snapshot: DailyWordSnapshot;
  cachedAtMs: number;
};

export async function getCachedCurrentWord(
  profile: UserProfile,
): Promise<CachedCurrentWordPayload | null> {
  logger.info(LogTag.WORD_CACHE, "Reading cached word snapshot");
  const key = storageKeys.currentWordSnapshot(buildCurrentWordProfileKey(profile));
  const raw = await kv.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CachedCurrentWordPayload;
    if (!parsed.snapshot || typeof parsed.dateKey !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedCurrentWord(
  profile: UserProfile,
  snapshot: DailyWordSnapshot,
): Promise<void> {
  logger.info(LogTag.WORD_CACHE, "Writing word snapshot to cache");
  const key = storageKeys.currentWordSnapshot(buildCurrentWordProfileKey(profile));
  const payload: CachedCurrentWordPayload = {
    dateKey: getLocalCalendarDateKey(),
    snapshot,
    cachedAtMs: Date.now(),
  };
  await kv.setItem(key, JSON.stringify(payload));
  logger.info(LogTag.WORD_CACHE, "Cache updated (current word snapshot)");
}

/** True when cache matches today's local date (word-of-day can roll at midnight). */
export function isCurrentWordCacheValidForToday(
  cached: CachedCurrentWordPayload | null,
): boolean {
  if (!cached) {
    return false;
  }
  return cached.dateKey === getLocalCalendarDateKey();
}
