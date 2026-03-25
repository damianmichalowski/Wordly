import { storageKeys } from "@/src/constants/storageKeys";
import * as kv from "@/src/services/storage/kvStorage";
import { LogTag, logger } from "@/src/utils/logger";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

export type KnownWordsBundlePayload = {
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
  syncedAtMs: number;
};

export async function getKnownWordsBundleCache(
  userId: string,
  options?: { silent?: boolean },
): Promise<KnownWordsBundlePayload | null> {
  if (!options?.silent) {
    logger.info(LogTag.KNOWN_WORDS_CACHE, "Reading known words bundle");
  }
  const raw = await kv.getItem(storageKeys.knownWordsBundle(userId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as KnownWordsBundlePayload;
  } catch {
    return null;
  }
}

export async function setKnownWordsBundleCache(
  userId: string,
  payload: Omit<KnownWordsBundlePayload, "syncedAtMs">,
): Promise<void> {
  logger.info(
    LogTag.KNOWN_WORDS_CACHE,
    `Writing known words bundle (${payload.words.length} words)`,
  );
  const full: KnownWordsBundlePayload = {
    ...payload,
    syncedAtMs: Date.now(),
  };
  await kv.setItem(
    storageKeys.knownWordsBundle(userId),
    JSON.stringify(full),
  );
}

export async function clearKnownWordsBundleCache(userId: string): Promise<void> {
  await kv.removeItem(storageKeys.knownWordsBundle(userId));
}

/**
 * Optimistically append a word marked as known on the home screen (instant library update).
 */
export async function mergeKnownWordIntoCache(
  userId: string,
  word: VocabularyWord,
  progress: UserWordProgress,
): Promise<void> {
  logger.info(
    LogTag.KNOWN_WORDS_CACHE,
    `Known word added locally (sense_id=${word.id})`,
  );
  const existing = await getKnownWordsBundleCache(userId, { silent: true });
  if (!existing) {
    logger.info(
      LogTag.KNOWN_WORDS_CACHE,
      "No existing bundle to merge into; skip optimistic merge",
    );
    return;
  }
  const progressByWordId = {
    ...existing.progressByWordId,
    [word.id]: progress,
  };
  const words = existing.words.some((w) => w.id === word.id)
    ? existing.words.map((w) => (w.id === word.id ? word : w))
    : [word, ...existing.words];
  await setKnownWordsBundleCache(userId, { words, progressByWordId });
}
