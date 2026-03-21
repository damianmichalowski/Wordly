export type WordProgressStatus = 'active' | 'known' | 'skipped' | 'review';

export type UserWordProgress = {
  wordId: string;
  status: WordProgressStatus;
  firstSeenAt: string;
  markedKnownAt?: string;
  skippedAt?: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
};

export type DailyWordState = {
  activeWordId: string | null;
  activeDate: string | null;
  updatedAt: string;
  stateVersion: number;
};
