import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { fetchDailyWordState } from "@/src/services/api/progressApi";
import {
    applyDailyWordAction,
    getDailyWordSnapshot,
} from "@/src/services/dailyWord/dailyWordService";
import { getUserProfile } from "@/src/services/storage/profileStorage";
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
import { vocabularyWordDisplayTargetText } from "@/src/types/words";

type SnapshotOptions = {
  revealTranslation?: boolean;
};

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
    emptyReason: "onboarding-incomplete",
  };
}

export async function getWidgetSurfaceSnapshot(
  options: SnapshotOptions = {},
): Promise<WidgetSurfaceSnapshot> {
  const profile = await getUserProfile();
  if (!profile) {
    return buildUnavailableSnapshot();
  }

  const dailySnapshot = await getDailyWordSnapshot(profile);
  const word = dailySnapshot.activeWord;

  const homeParams = {
    wordId: word?.id,
    stateVersion: dailySnapshot.stateVersion,
    profile,
  };

  const hasActiveWord = Boolean(word?.id);

  return {
    deepLink: buildHomeDeepLink(homeParams),
    knownDeepLink: hasActiveWord
      ? buildWidgetActionDeepLink({ ...homeParams, action: "known" })
      : null,
    stateVersion: dailySnapshot.stateVersion,
    updatedAt: dailySnapshot.updatedAt,
    sourceLanguage: profile.languagePair.sourceLanguage,
    targetLanguage: profile.languagePair.targetLanguage,
    displayLevel: profile.displayLevel,
    wordId: word?.id ?? null,
    sourceText: word?.sourceText ?? null,
    targetText: options.revealTranslation
      ? word
        ? vocabularyWordDisplayTargetText(word)
        : null
      : null,
    emptyReason: dailySnapshot.emptyReason,
  };
}

export async function applyWidgetAction(params: {
  action: WidgetActionType;
  expectedStateVersion?: number;
}): Promise<WidgetActionResult> {
  const profile = await getUserProfile();
  if (!profile || profile.userId === "local-user" || !hasSupabaseEnv()) {
    return {
      status: "unavailable",
      snapshot: buildUnavailableSnapshot(),
    };
  }

  const state = await fetchDailyWordState(profile.userId);
  if (
    typeof params.expectedStateVersion === "number" &&
    params.expectedStateVersion !== state.stateVersion
  ) {
    return {
      status: "stale",
      snapshot: await getWidgetSurfaceSnapshot(),
    };
  }

  if (params.action !== "known") {
    return {
      status: "unavailable",
      snapshot: await getWidgetSurfaceSnapshot(),
    };
  }

  await syncWidgetLoadingSnapshot();
  await applyDailyWordAction(profile, "known");

  return {
    status: "ok",
    snapshot: await getWidgetSurfaceSnapshot(),
  };
}
