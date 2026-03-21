export type WidgetActionType = 'known' | 'skip';

export type WidgetSurfaceSnapshot = {
  deepLink: string;
  stateVersion: number;
  updatedAt: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayLevel: string;
  wordId: string | null;
  sourceText: string | null;
  targetText: string | null;
  emptyReason?: 'onboarding-incomplete' | 'no-words-for-config' | 'all-words-completed';
};

export type WidgetActionResult = {
  status: 'ok' | 'stale' | 'unavailable';
  snapshot: WidgetSurfaceSnapshot;
};
