import { storageKeys } from "@/src/constants/storageKeys";
import * as kv from "@/src/services/storage/kvStorage";
import { LogTag, logger } from "@/src/utils/logger";
import type { UserProfile } from "@/src/types/profile";
import type { VocabularyWord } from "@/src/types/words";

/** Large list; refresh at most once per TTL unless profile bucket changes (new cache key). */
const CANDIDATE_LIST_TTL_MS = 24 * 60 * 60 * 1000;

export function buildVocabularyCandidateCacheKey(profile: UserProfile): string {
  const p = profile.languagePair;
  return `${profile.userId}|${profile.displayLevel}|${p.sourceLanguage}|${p.targetLanguage}`;
}

type CachedPayload = {
  fetchedAtMs: number;
  words: VocabularyWord[];
};

export async function getCachedVocabularyCandidates(
  profile: UserProfile,
): Promise<VocabularyWord[] | null> {
  logger.info(LogTag.VOCAB_CACHE, "Reading vocabulary candidate list");
  const key = storageKeys.vocabularyCandidates(
    buildVocabularyCandidateCacheKey(profile),
  );
  const raw = await kv.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CachedPayload;
    if (
      !parsed.words ||
      typeof parsed.fetchedAtMs !== "number" ||
      Date.now() - parsed.fetchedAtMs > CANDIDATE_LIST_TTL_MS
    ) {
      return null;
    }
    return parsed.words;
  } catch {
    return null;
  }
}

export async function setCachedVocabularyCandidates(
  profile: UserProfile,
  words: VocabularyWord[],
): Promise<void> {
  logger.info(
    LogTag.VOCAB_CACHE,
    `Writing vocabulary candidate list (${words.length} words)`,
  );
  const key = storageKeys.vocabularyCandidates(
    buildVocabularyCandidateCacheKey(profile),
  );
  const payload: CachedPayload = {
    fetchedAtMs: Date.now(),
    words,
  };
  await kv.setItem(key, JSON.stringify(payload));
}

export async function clearVocabularyCandidatesCacheForProfile(
  profile: UserProfile,
): Promise<void> {
  const key = storageKeys.vocabularyCandidates(
    buildVocabularyCandidateCacheKey(profile),
  );
  await kv.removeItem(key);
}
