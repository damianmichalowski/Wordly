export type WordProgressStatus = 'active' | 'known' | 'skipped' | 'review';

export type UserWordProgress = {
  /** `vocabulary_senses.id` (to samo co `sense_id` w `vocabulary_sense_display`). */
  wordId: string;
  status: WordProgressStatus;
  firstSeenAt: string;
  markedKnownAt?: string;
  skippedAt?: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  /** Wyżej = trudniejsze (np. przycisk „znowu” w przyszłych fiszkach). */
  difficultyScore?: number;
};

export type DailyWordState = {
  activeWordId: string | null;
  activeDate: string | null;
  updatedAt: string;
  stateVersion: number;
};
