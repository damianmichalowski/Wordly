import { emitProfileSettingsSaved } from "@/src/events/profileSettingsEvents";
import { emitWordProgressUpdated } from "@/src/events/wordProgressEvents";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { fetchProgressMap, upsertSingleProgress } from "@/src/services/api/progressApi";
import { fetchVocabularyWordsBySenseIds } from "@/src/services/api/vocabularyApi";
import { perfLog } from "@/src/services/performance/perfLog";
import { LogTag, logger } from "@/src/utils/logger";
import { DEFAULT_REVISION_SORT_PREFS } from "@/src/services/revision/revisionSortPrefs";
import { sortKnownWordsForRevision } from "@/src/services/revision/revisionSort";
import { queueReviewProgressForRemoteSync } from "@/src/services/revision/revisionSessionProgressSync";
import { computeNextReviewAfterReview } from "@/src/services/revision/spacedRepetition";
import { getUserProfile } from "@/src/services/storage/profileStorage";
import {
  getKnownWordsBundleCache,
  setKnownWordsBundleCache,
} from "@/src/cache/knownWordsCache";
import type { UserProfile } from "@/src/types/profile";
import type { UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

export type KnownWordsRevisionBundle = {
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
};

/**
 * Full fetch from Supabase (progress + vocabulary rows). Updates local cache.
 */
export async function loadKnownWordsRevisionBundleFromRemote(
  profile: UserProfile,
): Promise<KnownWordsRevisionBundle> {
  if (!profile.userId || profile.userId === "local-user" || !hasSupabaseEnv()) {
    return { words: [], progressByWordId: {} };
  }

  logger.info(
    LogTag.KNOWN_WORDS_CACHE,
    "Fetching known words bundle from Supabase (full sync)",
  );
  perfLog.start("fetch-known-words-remote");
  const progressMap = await fetchProgressMap(profile.userId);
  const progressByWordId: Record<string, UserWordProgress> = {};
  const senseIdsOrdered: string[] = [];

  for (const item of Object.values(progressMap)) {
    if (item.status !== "known") {
      continue;
    }
    progressByWordId[item.wordId] = item;
    senseIdsOrdered.push(item.wordId);
  }

  if (senseIdsOrdered.length === 0) {
    perfLog.end("fetch-known-words-remote");
    const empty: KnownWordsRevisionBundle = { words: [], progressByWordId: {} };
    await setKnownWordsBundleCache(profile.userId, empty);
    return empty;
  }

  const words = await fetchVocabularyWordsBySenseIds(profile, senseIdsOrdered);
  const bundle: KnownWordsRevisionBundle = { words, progressByWordId };
  await setKnownWordsBundleCache(profile.userId, bundle);
  perfLog.end("fetch-known-words-remote");
  return bundle;
}

/**
 * Local-first: returns cached bundle when present; use
 * {@link loadKnownWordsRevisionBundleFromRemote} for a forced sync.
 */
export async function fetchKnownWordsRevisionBundle(
  profile: UserProfile,
): Promise<KnownWordsRevisionBundle> {
  if (!profile.userId || profile.userId === "local-user" || !hasSupabaseEnv()) {
    return { words: [], progressByWordId: {} };
  }

  perfLog.start("cache-known-words-read");
  const cached = await getKnownWordsBundleCache(profile.userId);
  perfLog.end("cache-known-words-read");
  if (cached) {
    logger.info(
      LogTag.REVISION_HUB,
      `Loaded known words from local cache (${cached.words.length} words)`,
    );
    return {
      words: cached.words,
      progressByWordId: cached.progressByWordId,
    };
  }
  logger.info(
    LogTag.REVISION_HUB,
    "Local cache empty — fetching known words from Supabase (one-shot)",
  );
  return loadKnownWordsRevisionBundleFromRemote(profile);
}

export async function getKnownWordsSortedByNewest(
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  const bundle = await fetchKnownWordsRevisionBundle(profile);
  return sortKnownWordsForRevision(
    bundle.words,
    bundle.progressByWordId,
    DEFAULT_REVISION_SORT_PREFS,
  );
}

/** @deprecated Use {@link getKnownWordsSortedByNewest} */
export async function getKnownWordsForRevision(
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  return getKnownWordsSortedByNewest(profile);
}

export async function removeFromKnown(wordId: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile || profile.userId === "local-user" || !hasSupabaseEnv()) {
    return;
  }

  const progressMap = await fetchProgressMap(profile.userId);
  const progress = progressMap[wordId];

  if (!progress || progress.status !== "known") {
    return;
  }

  const updated: UserWordProgress = {
    ...progress,
    status: "active",
    markedKnownAt: undefined,
  };

  await upsertSingleProgress(profile.userId, updated);

  const cached = await getKnownWordsBundleCache(profile.userId);
  if (cached) {
    const progressByWordId = { ...cached.progressByWordId };
    delete progressByWordId[wordId];
    const words = cached.words.filter((w) => w.id !== wordId);
    await setKnownWordsBundleCache(profile.userId, { words, progressByWordId });
  }

  emitProfileSettingsSaved();
}

/**
 * Records a revision “reveal” locally (SRS fields) and queues a batch Supabase upsert.
 * Does not call the network on the hot path.
 */
export async function markWordReviewed(wordId: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile || profile.userId === "local-user" || !hasSupabaseEnv()) {
    return;
  }

  const cached = await getKnownWordsBundleCache(profile.userId);
  if (!cached) {
    logger.warn(
      LogTag.KNOWN_WORDS_CACHE,
      `markWordReviewed: missing local bundle (sense_id=${wordId})`,
    );
    return;
  }

  const progress = cached.progressByWordId[wordId];
  if (!progress) {
    logger.warn(
      LogTag.KNOWN_WORDS_CACHE,
      `markWordReviewed: no progress for sense_id=${wordId}`,
    );
    return;
  }

  const now = new Date();
  const newCount = progress.reviewCount + 1;
  const nextReviewAt = computeNextReviewAfterReview(newCount, now);

  const updated: UserWordProgress = {
    ...progress,
    lastReviewedAt: now.toISOString(),
    reviewCount: newCount,
    nextReviewAt,
  };

  await setKnownWordsBundleCache(profile.userId, {
    words: cached.words,
    progressByWordId: {
      ...cached.progressByWordId,
      [wordId]: updated,
    },
  });

  queueReviewProgressForRemoteSync(profile.userId, updated);
  emitWordProgressUpdated();
}
