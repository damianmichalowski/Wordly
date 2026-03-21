import { mockVocabulary } from '@/src/constants/mockVocabulary';
import {
  readDailyWordState,
  readProgressMap,
  writeDailyWordState,
  writeProgressMap,
} from '@/src/services/storage/dailyWordStorage';
import type { DailyWordState, UserWordProgress } from '@/src/types/progress';
import type { UserProfile } from '@/src/types/profile';
import type { VocabularyWord } from '@/src/types/words';

type DailyAction = 'known' | 'skip';

export type DailyWordSnapshot = {
  activeWord: VocabularyWord | null;
  knownCount: number;
  skippedCount: number;
  remainingCount: number;
  totalCandidateCount: number;
  stateVersion: number;
  updatedAt: string;
  emptyReason?: 'onboarding-incomplete' | 'no-words-for-config' | 'all-words-completed';
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildCandidateList(profile: UserProfile): VocabularyWord[] {
  return mockVocabulary.filter(
    (word) =>
      word.sourceLanguageCode === profile.languagePair.sourceLanguage &&
      word.targetLanguageCode === profile.languagePair.targetLanguage &&
      word.cefrLevel === profile.displayLevel,
  );
}

function countStatuses(progressList: UserWordProgress[]) {
  const knownCount = progressList.filter((item) => item.status === 'known').length;
  const skippedCount = progressList.filter((item) => item.status === 'skipped').length;
  return { knownCount, skippedCount };
}

function selectNextWord(candidates: VocabularyWord[], progressByWordId: Record<string, UserWordProgress>) {
  return (
    candidates.find((word) => {
      const status = progressByWordId[word.id]?.status;
      return status !== 'known' && status !== 'skipped';
    }) ?? null
  );
}

export async function getDailyWordSnapshot(profile: UserProfile): Promise<DailyWordSnapshot> {
  const [initialState, progressMap] = await Promise.all([readDailyWordState(), readProgressMap()]);
  let state = initialState;
  const candidates = buildCandidateList(profile);

  if (candidates.length === 0) {
    const { knownCount, skippedCount } = countStatuses(Object.values(progressMap));
    return {
      activeWord: null,
      knownCount,
      skippedCount,
      remainingCount: 0,
      totalCandidateCount: 0,
      stateVersion: state.stateVersion,
      updatedAt: state.updatedAt,
      emptyReason: 'no-words-for-config',
    };
  }

  let activeWord = state.activeWordId ? candidates.find((item) => item.id === state.activeWordId) ?? null : null;
  const isCurrentWordCompleted =
    activeWord && ['known', 'skipped'].includes(progressMap[activeWord.id]?.status ?? '');

  if (!activeWord || isCurrentWordCompleted) {
    const nextWord = selectNextWord(candidates, progressMap);
    const nextState: DailyWordState = {
      activeWordId: nextWord?.id ?? null,
      activeDate: nextWord ? getTodayKey() : null,
      updatedAt: new Date().toISOString(),
      stateVersion: state.stateVersion + 1,
    };
    await writeDailyWordState(nextState);
    state = nextState;
    activeWord = nextWord;
  }

  const progressForCandidates = candidates
    .map((word) => progressMap[word.id])
    .filter((value): value is UserWordProgress => Boolean(value));
  const { knownCount, skippedCount } = countStatuses(progressForCandidates);
  const remainingCount = candidates.length - knownCount - skippedCount;

  return {
    activeWord,
    knownCount,
    skippedCount,
    remainingCount,
    totalCandidateCount: candidates.length,
    stateVersion: state.stateVersion,
    updatedAt: state.updatedAt,
    emptyReason: activeWord ? undefined : 'all-words-completed',
  };
}

export async function applyDailyWordAction(
  profile: UserProfile,
  action: DailyAction,
): Promise<DailyWordSnapshot> {
  const [state, progressMap] = await Promise.all([readDailyWordState(), readProgressMap()]);
  const candidates = buildCandidateList(profile);
  const activeWord = state.activeWordId ? candidates.find((item) => item.id === state.activeWordId) ?? null : null;

  if (!activeWord) {
    return getDailyWordSnapshot(profile);
  }

  const now = new Date().toISOString();
  const existing = progressMap[activeWord.id];

  // Idempotent updates: applying the same action repeatedly does not change state.
  if (action === 'known' && existing?.status === 'known') {
    return getDailyWordSnapshot(profile);
  }
  if (action === 'skip' && existing?.status === 'skipped') {
    return getDailyWordSnapshot(profile);
  }

  progressMap[activeWord.id] = {
    wordId: activeWord.id,
    status: action === 'known' ? 'known' : 'skipped',
    firstSeenAt: existing?.firstSeenAt ?? now,
    markedKnownAt: action === 'known' ? now : existing?.markedKnownAt,
    skippedAt: action === 'skip' ? now : existing?.skippedAt,
    reviewCount: existing?.reviewCount ?? 0,
    lastReviewedAt: existing?.lastReviewedAt,
    nextReviewAt: existing?.nextReviewAt,
  };

  const nextState: DailyWordState = {
    activeWordId: null,
    activeDate: getTodayKey(),
    updatedAt: now,
    stateVersion: state.stateVersion + 1,
  };

  await Promise.all([writeProgressMap(progressMap), writeDailyWordState(nextState)]);
  return getDailyWordSnapshot(profile);
}
