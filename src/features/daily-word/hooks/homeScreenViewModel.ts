import type { AchievementEventPayload } from "@/src/features/achievements/types/achievementEvents.types";
import type { LearningTrackProgress } from "@/src/features/profile/services/learningProgress.service";
import type { UserProfileSettings } from "@/src/features/profile/types/profile.types";
import type { DailyWordResult } from "@/src/features/daily-word/types/dailyWord.types";
import type {
  WordDetails,
  WordSense,
} from "@/src/features/word-details/types/wordDetails.types";
import { groupSensesByPartOfSpeech } from "@/src/features/daily-word/utils/groupSensesByPartOfSpeech";
import type { VocabularyWord } from "@/src/types/words";

import { HOME_SHOW_DAILY_HEADER_AND_TRACK_PILL } from "../homeScreen.constants";

/** Count 2–4 → „słowa”, 1 → „słowo”, else „słów”. */
export function polishWordsForm(n: number): string {
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

export function computeTrackCompleted(
  trackProgress: LearningTrackProgress | null | undefined,
): boolean {
  return (
    trackProgress != null &&
    trackProgress.availableCount > 0 &&
    trackProgress.knownCount >= trackProgress.availableCount
  );
}

export function mergeAchievementQueues(
  entryPending: AchievementEventPayload[],
  lastFromDaily: AchievementEventPayload[],
): AchievementEventPayload[] {
  const map = new Map<string, AchievementEventPayload>();
  for (const e of entryPending) {
    map.set(e.eventId, e);
  }
  for (const e of lastFromDaily) {
    map.set(e.eventId, e);
  }
  return [...map.values()];
}

export function resolveTrackLabel(
  profileSettings: UserProfileSettings | null | undefined,
): string | null {
  if (!profileSettings) return null;
  if (profileSettings.learning_mode_type === "difficulty") {
    const lvl = profileSettings.learning_level;
    if (!lvl) return "Difficulty";
    return lvl.charAt(0).toUpperCase() + lvl.slice(1);
  }
  return profileSettings.selected_category?.name ?? "Category";
}

export type HomeWordPanel = {
  kind: "word";
  word: DailyWordResult;
  details: WordDetails;
  orderedSenses: WordSense[];
  posGroups: ReturnType<typeof groupSensesByPartOfSpeech>;
  firstTranslation: string;
  ipa: string | null;
  speakPayload: VocabularyWord | null;
};

export type HomeMainPanel =
  | { kind: "skeleton"; showBridgeHint: boolean }
  | { kind: "no_daily_word" }
  | { kind: "transport_retry"; showSkeletonInsteadOfMessage: boolean }
  | HomeWordPanel
  | { kind: "fallback_skeleton" };

type DailySliceForPanel = {
  isLoading: boolean;
  loadFailed: boolean;
  confirmedNoDailyWord: boolean;
  transportFetchBusy: boolean;
  exhaustedAwaitingTrackCelebration: boolean;
  data: DailyWordResult | null;
};

/**
 * Single place for main-area branching (non-celebrate). Order matters: unresolved / transport
 * must not be conflated with confirmed empty or business conclusions.
 */
export function computeHomeMainPanel(
  daily: DailySliceForPanel,
  stuckDailyLoad: boolean,
  isTrackCompleted: boolean,
): HomeMainPanel {
  const showDailySkeleton =
    (daily.isLoading && !stuckDailyLoad) ||
    (daily.exhaustedAwaitingTrackCelebration && !isTrackCompleted);

  if (showDailySkeleton) {
    return {
      kind: "skeleton",
      showBridgeHint:
        daily.exhaustedAwaitingTrackCelebration && !isTrackCompleted,
    };
  }

  if (daily.confirmedNoDailyWord) {
    return { kind: "no_daily_word" };
  }

  const showDailyTransportRetry = daily.loadFailed || stuckDailyLoad;
  if (showDailyTransportRetry) {
    return {
      kind: "transport_retry",
      showSkeletonInsteadOfMessage: daily.transportFetchBusy,
    };
  }

  const details = daily.data?.details ?? null;
  const assignment = daily.data?.assignment ?? null;
  if (!details || !assignment) {
    return { kind: "fallback_skeleton" };
  }

  const list = details.senses ?? [];
  const orderedSenses =
    list.length === 0
      ? []
      : [...list].sort((a, b) => a.sense_order - b.sense_order);
  const posGroups = groupSensesByPartOfSpeech(orderedSenses);
  const firstTranslation = orderedSenses[0]?.translation?.text ?? "";
  const ipa = details.ipa?.trim() ?? null;

  const speakPayload: VocabularyWord | null =
    details && assignment
      ? {
          id: details.word_id,
          sourceLanguageCode: details.target_language.code as VocabularyWord["sourceLanguageCode"],
          targetLanguageCode: (details.senses[0]?.translation
            .native_language_id ?? "en") as VocabularyWord["targetLanguageCode"],
          sourceText: details.lemma,
          targetText: firstTranslation,
          exampleSource: "",
          exampleTarget: "",
          cefrLevel: (details.cefr.code ?? "A1") as VocabularyWord["cefrLevel"],
          pronunciationText: details.ipa ?? undefined,
          audioUrl: null,
        }
      : null;

  return {
    kind: "word",
    word: daily.data!,
    details,
    orderedSenses,
    posGroups,
    firstTranslation,
    ipa,
    speakPayload,
  };
}

export function computeMainScrollCentered(panel: HomeMainPanel): boolean {
  if (panel.kind === "skeleton") {
    return false;
  }
  if (panel.kind === "no_daily_word") {
    return true;
  }
  if (panel.kind === "transport_retry") {
    return true;
  }
  return false;
}

export function computeFooterVisible(panel: HomeMainPanel): boolean {
  return panel.kind === "word" || panel.kind === "transport_retry";
}

export function computeHasWordContent(panel: HomeMainPanel): boolean {
  return panel.kind === "word";
}

export type CelebrateViewInput = {
  trackProgress: LearningTrackProgress;
  trackLabel: string | null;
  achievementQueue: AchievementEventPayload[];
};

export function buildCelebrateView(input: CelebrateViewInput) {
  const n = input.trackProgress.availableCount;
  const wordsForm = polishWordsForm(n);
  const label = input.trackLabel ?? "…";
  const hasTrophies = input.achievementQueue.length > 0;
  const showTrophyDescription =
    hasTrophies && input.achievementQueue.length <= 1;
  const trophyIconSize = hasTrophies ? 20 : 22;
  const heroTrophySize = hasTrophies ? 52 : 64;
  return {
    n,
    wordsForm,
    trackLabelDisplay: label,
    hasTrophies,
    showTrophyDescription,
    trophyIconSize,
    heroTrophySize,
    achievementQueue: input.achievementQueue,
  };
}

export function computeHeaderPillProps(args: {
  profileSettings: UserProfileSettings | null | undefined;
  isLoadingProfile: boolean;
  trackProgress: LearningTrackProgress | null | undefined;
  isLoadingTrack: boolean;
}) {
  if (!HOME_SHOW_DAILY_HEADER_AND_TRACK_PILL) {
    return {
      show: false as const,
      isInitialProfileLoading: false,
      trackLabel: null as string | null,
      progressPercent: null as number | null,
      isPercentPending: false,
    };
  }
  const isInitialProfileLoading =
    args.isLoadingProfile && !args.profileSettings;
  const trackLabel = resolveTrackLabel(args.profileSettings ?? null);
  let progressPercent: number | null = null;
  if (args.trackProgress) {
    progressPercent =
      args.trackProgress.availableCount > 0
        ? args.trackProgress.progressPercent
        : 0;
  }
  const isPercentPending =
    args.isLoadingTrack && !args.trackProgress;
  return {
    show: true as const,
    isInitialProfileLoading,
    trackLabel,
    progressPercent,
    isPercentPending,
  };
}

export function computeAchievementModalVisible(args: {
  activeAchievement: AchievementEventPayload | null;
  isTrackCompleted: boolean;
  exhaustedAwaitingTrackCelebration: boolean;
}): boolean {
  return (
    Boolean(args.activeAchievement) &&
    !args.isTrackCompleted &&
    !args.exhaustedAwaitingTrackCelebration
  );
}
