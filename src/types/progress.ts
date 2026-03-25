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

/**
 * Remote row `daily_word_state` (+ local copies). After a successful rollover, `activeDate` matches
 * today’s local calendar key; repeating resolution is a no-op (idempotent).
 */
export type DailyWordState = {
  /** `vocabulary_senses.id` / sense_id — word assigned to `activeDate`. */
  activeWordId: string | null;
  /** Local YYYY-MM-DD this `activeWordId` was selected for (see `getLocalCalendarDateKey`). */
  activeDate: string | null;
  updatedAt: string;
  stateVersion: number;
};
