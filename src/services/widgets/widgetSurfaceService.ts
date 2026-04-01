import type { DailyWordResult } from "@/src/features/daily-word/types/dailyWord.types";
import {
    getDailyWordWithDetails,
    markDailyWordAsKnown,
} from "@/src/features/daily-word/services/dailyWord.service";
import {
    getLearningTrackProgress,
    type LearningTrackProgress,
} from "@/src/features/profile/services/learningProgress.service";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import type { UserProfileSettings } from "@/src/features/profile/types/profile.types";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import {
    buildHomeDeepLink,
    buildWidgetActionDeepLink,
} from "@/src/services/widgets/deepLinks";
import { syncWidgetLoadingSnapshot } from "@/src/services/widgets/widgetLoadingSync";
import type {
    WidgetActionResult,
    WidgetActionType,
    WidgetSurfaceSnapshot,
} from "@/src/types/widgets";

type SnapshotOptions = {
  revealTranslation?: boolean;
};

/** Do 3 linii tłumaczeń na widżet (sensy wg `sense_order`). */
export function translationLinesForWidget(
  senses:
    | { sense_order: number; translation: { text: string } }[]
    | undefined,
  maxLines = 3,
): string[] {
  if (!senses?.length) {
    return [];
  }
  return [...senses]
    .sort((a, b) => a.sense_order - b.sense_order)
    .slice(0, maxLines)
    .map((s) => s.translation.text.trim())
    .filter((t) => t.length > 0);
}

/** Zgodne z `getOrCreateDailyWord`, brak wiersza z RPC; nie traktujemy jako błąd widgetu. */
const DAILY_WORD_NOT_RETURNED = "Daily word was not returned";

function polishWordsForm(n: number): string {
  if (n === 1) {
    return "słowo";
  }
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return "słowa";
  }
  return "słów";
}

function trackLabelFromSettings(settings: UserProfileSettings): string {
  if (settings.learning_mode_type === "difficulty") {
    const lvl = settings.learning_level;
    if (!lvl) {
      return "…";
    }
    return lvl.charAt(0).toUpperCase() + lvl.slice(1);
  }
  return settings.selected_category?.name ?? "…";
}

function buildTrackCompletedWidgetSnapshot(
  settings: UserProfileSettings,
  track: LearningTrackProgress,
): WidgetSurfaceSnapshot {
  const n = track.availableCount;
  const label = trackLabelFromSettings(settings);
  const wordsForm = polishWordsForm(n);
  const homeParamsEmpty = {
    wordId: null as string | null,
    stateVersion: 0,
    sourceLanguageCode: settings.native_language.code,
    targetLanguageCode: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
  };
  return {
    deepLink: buildHomeDeepLink(homeParamsEmpty),
    knownDeepLink: null,
    stateVersion: 0,
    updatedAt: new Date().toISOString(),
    sourceLanguage: settings.native_language.code,
    targetLanguage: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
    wordId: null,
    sourceText: null,
    targetText: null,
    targetTranslationLines: null,
    emptyReason: "all-words-completed",
    celebrationTitle: "Mega robota!",
    celebrationSubtitle: `${n} ${wordsForm} · ${label}`,
  };
}

function buildNoDailyWordWidgetSnapshot(
  settings: UserProfileSettings,
): WidgetSurfaceSnapshot {
  const homeParamsEmpty = {
    wordId: null as string | null,
    stateVersion: 0,
    sourceLanguageCode: settings.native_language.code,
    targetLanguageCode: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
  };
  return {
    deepLink: buildHomeDeepLink(homeParamsEmpty),
    knownDeepLink: null,
    stateVersion: 0,
    updatedAt: new Date().toISOString(),
    sourceLanguage: settings.native_language.code,
    targetLanguage: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
    wordId: null,
    sourceText: null,
    targetText: null,
    targetTranslationLines: null,
    emptyReason: "no-words-for-config",
  };
}

function buildUnavailableSnapshot(): WidgetSurfaceSnapshot {
  return {
    deepLink: "wordly://(onboarding)",
    knownDeepLink: null,
    stateVersion: 0,
    updatedAt: new Date(0).toISOString(),
    sourceLanguage: "",
    targetLanguage: "",
    displayLevel: "",
    wordId: null,
    sourceText: null,
    targetText: null,
    targetTranslationLines: null,
    emptyReason: "onboarding-incomplete",
  };
}

export async function getWidgetSurfaceSnapshot(
  options: SnapshotOptions = {},
): Promise<WidgetSurfaceSnapshot> {
  const settings = await getUserProfileSettings();
  if (!settings) {
    return buildUnavailableSnapshot();
  }

  let daily: DailyWordResult;
  try {
    daily = await getDailyWordWithDetails();
  } catch (e) {
    if (e instanceof Error && e.message === DAILY_WORD_NOT_RETURNED) {
      try {
        const track = await getLearningTrackProgress();
        const completed =
          track.availableCount > 0 &&
          track.knownCount >= track.availableCount;
        if (completed) {
          return buildTrackCompletedWidgetSnapshot(settings, track);
        }
      } catch {
        /* fall through */
      }
      if (__DEV__) {
        console.warn("[wordly] syncWidgetSnapshotFromApp failed", e);
      }
      return buildNoDailyWordWidgetSnapshot(settings);
    }
    throw e;
  }

  const wordId = daily.details.word_id;
  const translationLines = options.revealTranslation
    ? translationLinesForWidget(daily.details.senses)
    : [];
  const translation =
    translationLines.length > 0 ? translationLines[0] : null;

  const homeParams = {
    wordId,
    stateVersion: 0,
    sourceLanguageCode: settings.native_language.code,
    targetLanguageCode: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
  };

  const hasActiveWord = Boolean(wordId);

  return {
    deepLink: buildHomeDeepLink(homeParams),
    knownDeepLink: hasActiveWord
      ? buildWidgetActionDeepLink({ ...homeParams, action: "known" })
      : null,
    stateVersion: 0,
    updatedAt: new Date().toISOString(),
    sourceLanguage: settings.native_language.code,
    targetLanguage: settings.learning_language.code,
    displayLevel: settings.learning_level ?? "",
    wordId,
    sourceText: daily.details.lemma,
    targetText: options.revealTranslation ? translation : null,
    targetTranslationLines:
      options.revealTranslation && translationLines.length > 0
        ? translationLines
        : null,
    emptyReason: undefined,
  };
}

export async function applyWidgetAction(params: {
  action: WidgetActionType;
  expectedStateVersion?: number;
}): Promise<WidgetActionResult> {
  const settings = await getUserProfileSettings();
  if (!settings || !hasSupabaseEnv()) {
    return {
      status: "unavailable",
      snapshot: buildUnavailableSnapshot(),
    };
  }

  if (params.action !== "known") {
    return {
      status: "unavailable",
      snapshot: await getWidgetSurfaceSnapshot(),
    };
  }

  await syncWidgetLoadingSnapshot();
  let daily: DailyWordResult;
  try {
    daily = await getDailyWordWithDetails();
  } catch (e) {
    if (e instanceof Error && e.message === DAILY_WORD_NOT_RETURNED) {
      return {
        status: "unavailable",
        snapshot: await getWidgetSurfaceSnapshot(),
      };
    }
    throw e;
  }
  await markDailyWordAsKnown(daily.details.word_id);

  return {
    status: "ok",
    snapshot: await getWidgetSurfaceSnapshot(),
  };
}
