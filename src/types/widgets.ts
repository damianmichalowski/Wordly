export type WidgetActionType = 'known';

export type WidgetSurfaceSnapshot = {
  deepLink: string;
  /** iOS medium widget: tap „Known” → `applyWidgetAction` po otwarciu aplikacji */
  knownDeepLink: string | null;
  stateVersion: number;
  updatedAt: string;
  sourceLanguage: string;
  targetLanguage: string;
  displayLevel: string;
  wordId: string | null;
  sourceText: string | null;
  targetText: string | null;
  emptyReason?: 'onboarding-incomplete' | 'no-words-for-config' | 'all-words-completed';
  /** Ustawiane przed pobraniem następnego słowa (Known); widgecik pokazuje stan ładowania. */
  uiState?: 'loading' | 'ready';
};

export type WidgetActionResult = {
  status: 'ok' | 'stale' | 'unavailable';
  snapshot: WidgetSurfaceSnapshot;
};
