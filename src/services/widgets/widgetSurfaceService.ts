import { applyDailyWordAction, getDailyWordSnapshot } from '@/src/services/dailyWord/dailyWordService';
import { readDailyWordState } from '@/src/services/storage/dailyWordStorage';
import { getUserProfile } from '@/src/services/storage/profileStorage';
import { buildHomeDeepLink } from '@/src/services/widgets/deepLinks';
import type { WidgetActionResult, WidgetActionType, WidgetSurfaceSnapshot } from '@/src/types/widgets';

type SnapshotOptions = {
  revealTranslation?: boolean;
};

function buildUnavailableSnapshot(): WidgetSurfaceSnapshot {
  return {
    deepLink: 'wordly://(onboarding)',
    stateVersion: 0,
    updatedAt: new Date(0).toISOString(),
    sourceLanguage: '',
    targetLanguage: '',
    displayLevel: '',
    wordId: null,
    sourceText: null,
    targetText: null,
    emptyReason: 'onboarding-incomplete',
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

  return {
    deepLink: buildHomeDeepLink({
      wordId: word?.id,
      stateVersion: dailySnapshot.stateVersion,
      profile,
    }),
    stateVersion: dailySnapshot.stateVersion,
    updatedAt: dailySnapshot.updatedAt,
    sourceLanguage: profile.languagePair.sourceLanguage,
    targetLanguage: profile.languagePair.targetLanguage,
    displayLevel: profile.displayLevel,
    wordId: word?.id ?? null,
    sourceText: word?.sourceText ?? null,
    targetText: options.revealTranslation ? (word?.targetText ?? null) : null,
    emptyReason: dailySnapshot.emptyReason,
  };
}

export async function applyWidgetAction(params: {
  action: WidgetActionType;
  expectedStateVersion?: number;
}): Promise<WidgetActionResult> {
  const profile = await getUserProfile();
  if (!profile) {
    return {
      status: 'unavailable',
      snapshot: buildUnavailableSnapshot(),
    };
  }

  const state = await readDailyWordState();
  if (
    typeof params.expectedStateVersion === 'number' &&
    params.expectedStateVersion !== state.stateVersion
  ) {
    return {
      status: 'stale',
      snapshot: await getWidgetSurfaceSnapshot(),
    };
  }

  await applyDailyWordAction(profile, params.action);

  return {
    status: 'ok',
    snapshot: await getWidgetSurfaceSnapshot(),
  };
}
