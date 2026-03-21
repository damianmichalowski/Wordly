import { mockVocabulary } from '@/src/constants/mockVocabulary';
import { readProgressMap, writeProgressMap } from '@/src/services/storage/dailyWordStorage';
import type { UserProfile } from '@/src/types/profile';
import type { VocabularyWord } from '@/src/types/words';

function matchProfilePair(word: VocabularyWord, profile: UserProfile) {
  return (
    word.sourceLanguageCode === profile.languagePair.sourceLanguage &&
    word.targetLanguageCode === profile.languagePair.targetLanguage
  );
}

export async function getKnownWordsForRevision(profile: UserProfile): Promise<VocabularyWord[]> {
  const progressMap = await readProgressMap();
  const knownWordIds = new Set(
    Object.values(progressMap)
      .filter((item) => item.status === 'known')
      .map((item) => item.wordId),
  );

  return mockVocabulary.filter((word) => knownWordIds.has(word.id) && matchProfilePair(word, profile));
}

export async function markWordReviewed(wordId: string): Promise<void> {
  const progressMap = await readProgressMap();
  const progress = progressMap[wordId];

  if (!progress) {
    return;
  }

  progressMap[wordId] = {
    ...progress,
    lastReviewedAt: new Date().toISOString(),
    reviewCount: progress.reviewCount + 1,
  };

  await writeProgressMap(progressMap);
}
