import WordlyWidgetBridge from 'wordly-widget-bridge';

import type { WidgetSurfaceSnapshot } from '@/src/types/widgets';

/**
 * Zapisuje snapshot „w trakcie ładowania” do App Group i przeładowuje timeline widgecie
 * (natywnie: `WidgetCenter.shared.reloadTimelines`).
 * Używaj przed `applyDailyWordAction(..., 'known' | 'skip')` / długim odświeżeniem słowa.
 */
export async function syncWidgetLoadingSnapshot(): Promise<void> {
  try {
    const loading: WidgetSurfaceSnapshot = {
      deepLink: 'wordly://(tabs)/home',
      knownDeepLink: null,
      stateVersion: -1,
      updatedAt: new Date().toISOString(),
      sourceLanguage: '',
      targetLanguage: '',
      displayLevel: '',
      wordId: null,
      sourceText: null,
      targetText: null,
      uiState: 'loading',
    };
    await WordlyWidgetBridge.setSnapshotJson(JSON.stringify(loading));
  } catch (error) {
    if (__DEV__) {
      console.warn('[wordly] syncWidgetLoadingSnapshot failed', error);
    }
  }
}
