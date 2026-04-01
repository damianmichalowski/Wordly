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
  /** Do 3 tłumaczeń (sensy), jedno pod drugim, preferowane nad pojedynczym `targetText`. */
  targetTranslationLines?: string[] | null;
  emptyReason?: 'onboarding-incomplete' | 'no-words-for-config' | 'all-words-completed';
  /** Mini „Mega robota!”, gdy `emptyReason === 'all-words-completed'`. */
  celebrationTitle?: string | null;
  celebrationSubtitle?: string | null;
  /** Ustawiane przed pobraniem następnego słowa (Known); widgecik pokazuje stan ładowania. */
  uiState?: 'loading' | 'ready';
};

export type WidgetActionResult = {
  status: 'ok' | 'stale' | 'unavailable';
  snapshot: WidgetSurfaceSnapshot;
};
