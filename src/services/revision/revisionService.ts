import { fetchProgressMap, saveProgressMap } from '@/src/services/api/progressApi';
import { fetchVocabularyWordsBySenseIds } from '@/src/services/api/vocabularyApi';
import { emitProfileSettingsSaved } from '@/src/events/profileSettingsEvents';
import { emitWordProgressUpdated } from '@/src/events/wordProgressEvents';
import { hasSupabaseEnv } from '@/src/lib/supabase/client';
import { getUserProfile } from '@/src/services/storage/profileStorage';
import type { UserProfile } from '@/src/types/profile';
import type { UserWordProgress } from '@/src/types/progress';
import type { VocabularyWord } from '@/src/types/words';

import { DEFAULT_REVISION_SORT_PREFS } from '@/src/services/revision/revisionSortPrefs';
import { sortKnownWordsForRevision } from '@/src/services/revision/revisionSort';
import {
  computeNextReviewAfterReview,
} from '@/src/services/revision/spacedRepetition';

/**
 * Słowa „known” + mapa postępu (do sortowania po stronie UI).
 * `wordId` w progresie = `vocabulary_senses.id`.
 */
export async function fetchKnownWordsRevisionBundle(profile: UserProfile): Promise<{
  words: VocabularyWord[];
  progressByWordId: Record<string, UserWordProgress>;
}> {
  if (!profile.userId || profile.userId === 'local-user' || !hasSupabaseEnv()) {
    return { words: [], progressByWordId: {} };
  }

  const progressMap = await fetchProgressMap(profile.userId);
  const progressByWordId: Record<string, UserWordProgress> = {};
  const senseIdsOrdered: string[] = [];

  for (const item of Object.values(progressMap)) {
    if (item.status !== 'known') {
      continue;
    }
    progressByWordId[item.wordId] = item;
    senseIdsOrdered.push(item.wordId);
  }

  if (senseIdsOrdered.length === 0) {
    return { words: [], progressByWordId: {} };
  }

  const words = await fetchVocabularyWordsBySenseIds(profile, senseIdsOrdered);
  return { words, progressByWordId };
}

/**
 * Znane słowa dla pary językowej profilu, posortowane od **najnowszego** oznaczenia „known”.
 * `wordId` w progresie = `vocabulary_senses.id` (widok `vocabulary_sense_display`).
 */
export async function getKnownWordsSortedByNewest(profile: UserProfile): Promise<VocabularyWord[]> {
  const bundle = await fetchKnownWordsRevisionBundle(profile);
  return sortKnownWordsForRevision(
    bundle.words,
    bundle.progressByWordId,
    DEFAULT_REVISION_SORT_PREFS,
  );
}

/** @deprecated Użyj {@link getKnownWordsSortedByNewest} */
export async function getKnownWordsForRevision(profile: UserProfile): Promise<VocabularyWord[]> {
  return getKnownWordsSortedByNewest(profile);
}

/** Cofa status „known”; słowo wraca do kolejki Daily (status `active`). */
export async function removeFromKnown(wordId: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile || profile.userId === 'local-user' || !hasSupabaseEnv()) {
    return;
  }

  const progressMap = await fetchProgressMap(profile.userId);
  const progress = progressMap[wordId];

  if (!progress || progress.status !== 'known') {
    return;
  }

  progressMap[wordId] = {
    ...progress,
    status: 'active',
    markedKnownAt: undefined,
  };

  await saveProgressMap(profile.userId, progressMap);
  emitProfileSettingsSaved();
}

export async function markWordReviewed(wordId: string): Promise<void> {
  const profile = await getUserProfile();
  if (!profile || profile.userId === 'local-user' || !hasSupabaseEnv()) {
    return;
  }

  const progressMap = await fetchProgressMap(profile.userId);
  const progress = progressMap[wordId];

  if (!progress) {
    return;
  }

  const now = new Date();
  const newCount = progress.reviewCount + 1;
  const nextReviewAt = computeNextReviewAfterReview(newCount, now);

  progressMap[wordId] = {
    ...progress,
    lastReviewedAt: now.toISOString(),
    reviewCount: newCount,
    nextReviewAt,
  };

  await saveProgressMap(profile.userId, progressMap);
  emitWordProgressUpdated();
}
