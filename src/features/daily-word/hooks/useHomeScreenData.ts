import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo } from "react";

import { useAchievementEvents } from "@/src/features/achievements";
import { useUserProfileSettings } from "@/src/features/profile/hooks/useUserProfileSettings";
import { STUCK_LOADING_MS, useStuckLoading } from "@/src/hooks/useStuckLoading";

import type { HomeMainPanel } from "./homeScreenViewModel";
import {
  buildCelebrateView,
  computeAchievementModalVisible,
  computeFooterVisible,
  computeHasWordContent,
  computeHeaderPillProps,
  computeHomeMainPanel,
  computeMainScrollCentered,
  computeTrackCompleted,
  mergeAchievementQueues,
  resolveTrackLabel,
} from "./homeScreenViewModel";
import { useDailyWord } from "./useDailyWord";
import { useLearningTrackProgress } from "./useLearningTrackProgress";

/**
 * Home / Daily Word: single orchestrator — daily word, track progress, profile (pill),
 * achievements, focus-based stale refetch, and a normalized `view` model for rendering.
 */
export function useHomeScreenData() {
  const daily = useDailyWord();
  const track = useLearningTrackProgress();
  const profile = useUserProfileSettings();
  const achievement = useAchievementEvents();

  const stuckDailyLoad = useStuckLoading(
    daily.isLoading && !daily.loadFailed && !daily.confirmedNoDailyWord,
    STUCK_LOADING_MS,
  );

  useFocusEffect(
    useCallback(() => {
      daily.refreshIfStale();
    }, [daily.refreshIfStale]),
  );

  const { data: trackProgress, isLoading: isLoadingTrack } = track;
  const { data: profileSettings, isLoading: isLoadingProfile } = profile;

  const isTrackCompleted = useMemo(
    () => computeTrackCompleted(trackProgress),
    [trackProgress],
  );

  const achievementQueue = useMemo(
    () =>
      mergeAchievementQueues(
        achievement.entryPendingEvents,
        daily.lastAchievementEvents,
      ),
    [achievement.entryPendingEvents, daily.lastAchievementEvents],
  );

  const activeAchievement = achievementQueue[0] ?? null;

  const trackLabel = useMemo(
    () => resolveTrackLabel(profileSettings ?? null),
    [profileSettings],
  );

  const view = useMemo(():
    | {
        mode: "celebrate";
        celebrate: ReturnType<typeof buildCelebrateView>;
        achievementModalVisible: boolean;
        achievementQueue: typeof achievementQueue;
        activeAchievement: typeof activeAchievement;
        headerPill: ReturnType<typeof computeHeaderPillProps>;
      }
    | {
        mode: "main";
        mainPanel: HomeMainPanel;
        mainScrollCentered: boolean;
        footerVisible: boolean;
        hasWordContent: boolean;
        achievementModalVisible: boolean;
        achievementQueue: typeof achievementQueue;
        activeAchievement: typeof activeAchievement;
        headerPill: ReturnType<typeof computeHeaderPillProps>;
      } => {
    const headerPill = computeHeaderPillProps({
      profileSettings: profileSettings ?? null,
      isLoadingProfile,
      trackProgress: trackProgress ?? null,
      isLoadingTrack,
    });

    const achievementModalVisible = computeAchievementModalVisible({
      activeAchievement,
      isTrackCompleted,
      exhaustedAwaitingTrackCelebration: daily.exhaustedAwaitingTrackCelebration,
    });

    const celebrateEligible = isTrackCompleted && trackProgress != null;

    if (celebrateEligible) {
      return {
        mode: "celebrate",
        celebrate: buildCelebrateView({
          trackProgress,
          trackLabel,
          achievementQueue,
        }),
        achievementModalVisible,
        achievementQueue,
        activeAchievement,
        headerPill,
      };
    }

    const mainPanel = computeHomeMainPanel(
      {
        isLoading: daily.isLoading,
        loadFailed: daily.loadFailed,
        confirmedNoDailyWord: daily.confirmedNoDailyWord,
        transportFetchBusy: daily.transportFetchBusy,
        exhaustedAwaitingTrackCelebration: daily.exhaustedAwaitingTrackCelebration,
        data: daily.data,
      },
      stuckDailyLoad,
      isTrackCompleted,
    );

    return {
      mode: "main",
      mainPanel,
      mainScrollCentered: computeMainScrollCentered(mainPanel),
      footerVisible: computeFooterVisible(mainPanel),
      hasWordContent: computeHasWordContent(mainPanel),
      achievementModalVisible,
      achievementQueue,
      activeAchievement,
      headerPill,
    };
  }, [
    activeAchievement,
    achievementQueue,
    daily.confirmedNoDailyWord,
    daily.data,
    daily.exhaustedAwaitingTrackCelebration,
    daily.isLoading,
    daily.loadFailed,
    daily.transportFetchBusy,
    isLoadingProfile,
    isLoadingTrack,
    isTrackCompleted,
    profileSettings,
    stuckDailyLoad,
    trackLabel,
    trackProgress,
  ]);

  return {
    view,
    daily,
    track,
    profile,
    achievement,
    stuckDailyLoad,
  };
}
