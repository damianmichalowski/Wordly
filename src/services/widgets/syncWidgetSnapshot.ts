import WordlyWidgetBridge from "wordly-widget-bridge";

import { getWidgetSurfaceSnapshot } from "@/src/services/widgets/widgetSurfaceService";

/**
 * Serializes `WidgetSurfaceSnapshot` to the native shared store (iOS App Group)
 * and triggers a WidgetKit timeline reload. Android stores JSON for a future AppWidget.
 */
export async function syncWidgetSnapshotFromApp(): Promise<void> {
  try {
    // Widget: sourceText = lemat (język nauki), targetText = gloss (ojczysty); patrz getCatalogLanguagePair.
    const snapshot = await getWidgetSurfaceSnapshot({
      revealTranslation: true,
    });
    await WordlyWidgetBridge.setSnapshotJson(JSON.stringify(snapshot));
  } catch (error) {
    if (__DEV__) {
      console.warn("[wordly] syncWidgetSnapshotFromApp failed", error);
    }
  }
}
