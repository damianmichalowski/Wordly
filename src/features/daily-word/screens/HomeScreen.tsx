import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { TrackProgressPill } from "@/src/components/ui/TrackProgressPill";
import {
    ANDROID_RIPPLE_ICON_ROUND,
    ANDROID_RIPPLE_PRIMARY,
    HIT_SLOP_MINI,
    primarySolidPressStyle,
    roundIconPressStyle,
} from "@/src/components/ui/interaction";
import { AchievementUnlockModal } from "@/src/features/achievements";
import { TransportRetryMessage } from "@/src/components/ui/TransportRetryMessage";
import { DailyWordScreenSkeleton } from "@/src/features/daily-word/components/DailyWordScreenSkeleton";
import { HOME_SHOW_DAILY_HEADER_AND_TRACK_PILL } from "@/src/features/daily-word/homeScreen.constants";
import { useHomeScreenData } from "@/src/features/daily-word/hooks/useHomeScreenData";
import { dailyWordCardStyles as card } from "@/src/features/daily-word/styles/dailyWordCard.styles";
import {
    canPronounce,
    speakWord,
} from "@/src/services/audio/pronunciationService";
import { syncWidgetSnapshotFromApp } from "@/src/services/widgets/syncWidgetSnapshot";
import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: StitchColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainerHigh,
    gap: 10,
  },
  markKnownInlineToast: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.error,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
    backgroundColor: StitchColors.surface,
  },
  /** Treść pod headerem: puste / ukończone / loading, wyrównanie jak reszta ekranu. */
  mainScroll: {
    flex: 1,
  },
  mainScrollContentCentered: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: "center",
    minHeight: 320,
    gap: 10,
    alignItems: "center",
  },
  /** Ukończenie toru: treść wyśrodkowana, przyciski przy dolnej krawędzi. */
  celebrateRoot: {
    flex: 1,
    minHeight: 0,
  },
  celebrateCenter: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  celebrateCenterInner: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    alignItems: "center",
    flexShrink: 1,
  },
  celebrateFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainerHigh,
    backgroundColor: StitchColors.surface,
    gap: 10,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    textAlign: "center",
    color: StitchColors.onSurfaceVariant,
  },
  celebrateTitle: {
    fontSize: 26,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  celebrateTextBlock: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 6,
    gap: 0,
  },
  celebrateTrackDone: {
    marginTop: 18,
    fontSize: 17,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 4,
  },
  celebrateTrackName: {
    color: StitchColors.primary,
    fontFamily: StitchFonts.bodySemi,
  },
  celebrateWordsBlock: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  celebrateWordsLearned: {
    fontSize: 20,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  celebrateWordsCount: {
    color: StitchColors.primary,
    fontFamily: StitchFonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  celebrateCheer: {
    marginTop: 16,
    fontSize: 17,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
  celebrateDivider: {
    marginTop: 22,
    marginBottom: 4,
    width: "56%",
    maxWidth: 220,
    height: StyleSheet.hairlineWidth,
    backgroundColor: StitchColors.outlineVariant,
    alignSelf: "center",
  },
  celebrateNextSteps: {
    marginTop: 18,
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 12,
  },
  celebrateTrophiesOuter: {
    marginTop: 16,
    alignSelf: "stretch",
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: StitchColors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: StitchColors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  celebrateTrophiesHeading: {
    fontSize: 16,
    fontFamily: StitchFonts.title,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  celebrateTrophiesSub: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 0,
  },
  celebrateTrophiesList: {
    gap: 8,
    alignSelf: "stretch",
  },
  celebrateTrophyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: StitchRadius.md,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${StitchColors.outlineVariant}99`,
  },
  celebrateTrophyIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(40, 108, 52, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  celebrateTrophyTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  celebrateTrophyTitle: {
    fontSize: 15,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    lineHeight: 20,
  },
  celebrateTrophyDesc: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 17,
  },
  actions: {
    marginTop: 4,
    gap: 12,
    width: "100%",
  },
  celebrateHeroIcon: {
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButton: {
    backgroundColor: StitchColors.surfaceContainerHigh,
    borderRadius: StitchRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 17,
  },
  secondaryButtonText: {
    color: StitchColors.onSurface,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
  trackCelebrationBridgeHint: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    paddingHorizontal: 16,
  },
});

export default function HomeScreen() {
  const widgetSyncedOnceRef = useRef(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { view, daily, track, profile, achievement } = useHomeScreenData();
  const { data: trackProgress } = track;
  const {
    isLoading,
    canAct,
    isSaving,
    markKnownInlineError,
    markKnown,
    transportFetchBusy,
    refresh,
    dismissLastAchievementEvent,
    clearLastAchievementEvents,
    exhaustedAwaitingTrackCelebration,
    clearExhaustedAwaitingTrackCelebration,
  } = daily;
  const { consumeAchievementEvents } = achievement;
  const { isLoading: isLoadingProfile } = profile;

  useEffect(() => {
    if (isLoading || isLoadingProfile) {
      return;
    }
    if (widgetSyncedOnceRef.current) {
      return;
    }
    widgetSyncedOnceRef.current = true;
    void syncWidgetSnapshotFromApp();
  }, [isLoading, isLoadingProfile]);

  const goToLearningModeSettings = useCallback(() => {
    logUserAction("button_press", { target: "daily_word_open_learning_settings" });
    router.push({
      pathname: "/(tabs)/settings",
      params: { focus: "learningMode" },
    });
  }, [router]);

  const goToRevision = useCallback(() => {
    logUserAction("button_press", { target: "daily_word_go_revision_hub" });
    router.push("/(tabs)/revision");
  }, [router]);

  const isTrackCompleted =
    trackProgress != null &&
    trackProgress.availableCount > 0 &&
    trackProgress.knownCount >= trackProgress.availableCount;

  useEffect(() => {
    if (isTrackCompleted && exhaustedAwaitingTrackCelebration) {
      clearExhaustedAwaitingTrackCelebration();
    }
  }, [
    isTrackCompleted,
    exhaustedAwaitingTrackCelebration,
    clearExhaustedAwaitingTrackCelebration,
  ]);

  const handleDismissAchievement = useCallback(
    async (eventId: string) => {
      await consumeAchievementEvents([eventId]);
      dismissLastAchievementEvent(eventId);
    },
    [consumeAchievementEvents, dismissLastAchievementEvent],
  );

  const goToTrophiesSettings = useCallback(() => {
    router.push({
      pathname: "/(tabs)/settings",
      params: { focus: "achievements" },
    });
  }, [router]);

  const dismissAllQueuedAchievements = useCallback(async () => {
    const ids = view.achievementQueue.map((e) => e.eventId);
    if (ids.length === 0) {
      return;
    }
    try {
      await consumeAchievementEvents(ids);
    } catch {
      /* best-effort */
    }
    clearLastAchievementEvents();
  }, [view.achievementQueue, consumeAchievementEvents, clearLastAchievementEvents]);

  const achievementModal = (
    <AchievementUnlockModal
      visible={view.achievementModalVisible}
      title={view.activeAchievement?.title ?? ""}
      subtitle={view.activeAchievement?.description ?? ""}
      primaryLabel="Go to trophies"
      onPrimaryPress={() => {
        if (!view.activeAchievement) {
          return;
        }
        const id = view.activeAchievement.eventId;
        void handleDismissAchievement(id).then(() => {
          goToTrophiesSettings();
        });
      }}
      secondaryLabel="Close"
      onSecondaryPress={() => {
        if (view.activeAchievement) {
          void handleDismissAchievement(view.activeAchievement.eventId);
        }
      }}
      onRequestClose={() => {
        if (view.activeAchievement) {
          void handleDismissAchievement(view.activeAchievement.eventId);
        }
      }}
    />
  );

  const header = view.headerPill.show ? (
    <ScreenHeader
      title="Daily word"
      titleSize="small"
      rightAccessory={
        <TrackProgressPill
          isInitialProfileLoading={view.headerPill.isInitialProfileLoading}
          trackName={view.headerPill.trackLabel ?? "…"}
          progressPercent={view.headerPill.progressPercent}
          isPercentPending={view.headerPill.isPercentPending}
        />
      }
    />
  ) : null;

  const screenTopPaddingStyle = useMemo(
    () =>
      HOME_SHOW_DAILY_HEADER_AND_TRACK_PILL
        ? undefined
        : { paddingTop: Math.max(insets.top, 10) },
    [insets.top],
  );

  /** Completed track: full-screen celebration (not driven by unresolved daily fetch). */
  if (view.mode === "celebrate") {
    const c = view.celebrate;
    const hasTrophies = c.hasTrophies;
    const showTrophyDescription = c.showTrophyDescription;
    const trophyIconSize = c.trophyIconSize;
    const heroTrophySize = c.heroTrophySize;

    return (
      <View style={[styles.screen, screenTopPaddingStyle]}>
        {header}
        <View style={styles.celebrateRoot}>
          <View style={styles.celebrateCenter}>
            <View style={styles.celebrateCenterInner}>
              <Animated.View entering={ZoomIn.duration(420)}>
                <Ionicons
                  name="trophy"
                  size={heroTrophySize}
                  color={StitchColors.secondary}
                  style={styles.celebrateHeroIcon}
                />
              </Animated.View>

              <Animated.View
                entering={FadeInDown.duration(380).delay(80)}
                style={styles.celebrateTextBlock}
              >
                <Text style={styles.celebrateTitle}>Mega robota!</Text>

                <Text
                  style={[
                    styles.celebrateTrackDone,
                    hasTrophies && { marginTop: 14 },
                  ]}
                >
                  Tor{" "}
                  <Text style={styles.celebrateTrackName}>
                    {c.trackLabelDisplay}
                  </Text>{" "}
                  ukończony.
                </Text>

                <View style={styles.celebrateWordsBlock}>
                  <Text style={styles.celebrateWordsLearned}>
                    Poznałeś{" "}
                    <Text style={styles.celebrateWordsCount}>{c.n}</Text>{" "}
                    {c.wordsForm}!
                  </Text>
                </View>

                <Text
                  style={[
                    styles.celebrateCheer,
                    hasTrophies && { marginTop: 12 },
                  ]}
                >
                  Tak trzymaj.
                </Text>

                <View
                  style={[
                    styles.celebrateDivider,
                    hasTrophies && { marginTop: 16, marginBottom: 2 },
                  ]}
                />

                <Text style={styles.celebrateNextSteps}>
                  Przejdź do ustawień i wybierz kolejny poziom lub kategorię.
                </Text>
              </Animated.View>

              {hasTrophies ? (
                <Animated.View
                  entering={FadeInDown.duration(400).delay(110)}
                  style={styles.celebrateTrophiesOuter}
                >
                  <Text style={styles.celebrateTrophiesHeading}>
                    Nowe trofea
                  </Text>
                  <Text style={styles.celebrateTrophiesSub}>
                    Zdobyte przy ukończeniu tego toru
                  </Text>
                  <View style={styles.celebrateTrophiesList}>
                    {c.achievementQueue.map((ev, i) => (
                      <Animated.View
                        key={ev.eventId}
                        entering={FadeInDown.duration(360).delay(
                          160 + i * 50,
                        )}
                        style={styles.celebrateTrophyCard}
                      >
                        <View style={styles.celebrateTrophyIconRing}>
                          <Ionicons
                            name="trophy"
                            size={trophyIconSize}
                            color={StitchColors.secondary}
                          />
                        </View>
                        <View style={styles.celebrateTrophyTextCol}>
                          <Text
                            style={styles.celebrateTrophyTitle}
                            numberOfLines={2}
                          >
                            {ev.title}
                          </Text>
                          {showTrophyDescription && ev.description ? (
                            <Text
                              style={styles.celebrateTrophyDesc}
                              numberOfLines={3}
                            >
                              {ev.description}
                            </Text>
                          ) : null}
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                </Animated.View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.celebrateFooter,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <Animated.View
              entering={FadeInDown.duration(360).delay(120)}
              style={styles.actions}
            >
              <Pressable
                android_ripple={ANDROID_RIPPLE_PRIMARY}
                style={({ pressed }) => [
                  styles.primaryButton,
                  primarySolidPressStyle(pressed, false),
                ]}
                onPress={() => {
                  logUserAction("button_press", {
                    target: "daily_word_track_done_next_level",
                  });
                  void dismissAllQueuedAchievements().finally(() => {
                    goToLearningModeSettings();
                  });
                }}
              >
                <Text style={styles.primaryButtonText}>
                  Kolejny poziom lub kategoria
                </Text>
              </Pressable>

              <Pressable
                android_ripple={ANDROID_RIPPLE_PRIMARY}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  primarySolidPressStyle(pressed, false),
                ]}
                onPress={() => {
                  logUserAction("button_press", {
                    target: "daily_word_track_done_go_revision",
                  });
                  void dismissAllQueuedAchievements().finally(() => {
                    goToRevision();
                  });
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  Przejdź do powtórek
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
        {achievementModal}
      </View>
    );
  }

  const { mainPanel, mainScrollCentered, footerVisible, hasWordContent } =
    view;

  let scrollInner: ReactNode;
  if (mainPanel.kind === "skeleton") {
    scrollInner = (
      <>
        <DailyWordScreenSkeleton />
        {mainPanel.showBridgeHint ? (
          <Text style={styles.trackCelebrationBridgeHint}>
            Już prawie… aktualizuję postęp toru.
          </Text>
        ) : null}
      </>
    );
  } else if (mainPanel.kind === "no_daily_word") {
    scrollInner = (
      <>
        <Ionicons
          name="book-outline"
          size={56}
          color={StitchColors.onSurfaceVariant}
          style={styles.emptyIcon}
        />
        <Text style={styles.title}>Brak słowa na dziś</Text>
        <Text style={styles.subtitle}>
          Dla obecnego trybu nauki nie ma już słów do losowania albo tor jest
          pusty. Zmień poziom, kategorię lub języki w ustawieniach.
        </Text>

        <View style={styles.actions}>
          <Pressable
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => [
              styles.primaryButton,
              primarySolidPressStyle(pressed, false),
            ]}
            onPress={goToLearningModeSettings}
          >
            <Text style={styles.primaryButtonText}>Otwórz ustawienia</Text>
          </Pressable>
        </View>
      </>
    );
  } else if (mainPanel.kind === "transport_retry") {
    scrollInner = mainPanel.showSkeletonInsteadOfMessage ? (
      <DailyWordScreenSkeleton />
    ) : (
      <TransportRetryMessage
        variant="embedded"
        isRetrying={transportFetchBusy}
        onRetry={() => {
          logUserAction("button_press", {
            target: "daily_word_retry_fetch",
          });
          void refresh();
        }}
      />
    );
  } else if (mainPanel.kind === "fallback_skeleton") {
    scrollInner = <DailyWordScreenSkeleton />;
  } else if (mainPanel.kind === "word") {
    const { details, posGroups, ipa, speakPayload } = mainPanel;
    scrollInner = (
      <>
        <View style={card.heroBlock}>
          <View style={card.heroTitleRow}>
            <Text style={card.lemma}>{details.lemma}</Text>
            <View style={card.heroMetaInline}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pronounce"
                android_ripple={ANDROID_RIPPLE_ICON_ROUND}
                hitSlop={HIT_SLOP_MINI}
                style={({ pressed }) => [
                  card.roundIconButton,
                  roundIconPressStyle(pressed, !canPronounce(speakPayload)),
                ]}
                onPress={() => {
                  logUserAction("button_press", {
                    target: "daily_word_pronounce",
                    wordId: details.word_id,
                  });
                  void speakWord(speakPayload as any);
                }}
                disabled={!canPronounce(speakPayload as any)}
              >
                <Ionicons
                  name="volume-medium"
                  size={22}
                  color={StitchColors.onSurface}
                />
              </Pressable>
            </View>
          </View>
          <View style={card.heroIpaRow}>
            {ipa ? <Text style={card.ipa}>/{ipa}/</Text> : null}
            <View style={card.pillCefrCompact}>
              <Text style={card.pillCefrCompactText}>{details.cefr.code}</Text>
            </View>
            {details.categories.map((cat) => (
              <View key={cat.id} style={card.pillCefrCompact}>
                <Text style={card.pillCefrCompactText}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {posGroups.map((group) => (
          <View key={group.posId} style={card.tile}>
            {group.senses.map((sense, idx) => {
              const examples = [...sense.translation.examples].sort(
                (a, b) => a.order - b.order,
              );
              const showFollows = idx > 0;
              return (
                <View
                  key={sense.sense_id}
                  style={[
                    card.senseBlock,
                    showFollows && card.senseBlockFollows,
                  ]}
                >
                  {idx === 0 ? (
                    <Text style={card.sensePos}>{group.posName}</Text>
                  ) : null}
                  <Text style={card.translation}>{sense.translation.text}</Text>
                  {examples.length > 0 ? (
                    <View style={card.examples}>
                      {examples.map((ex) => (
                        <View key={ex.id} style={card.exampleRow}>
                          <View style={card.exampleAccentBar} />
                          <Text style={card.exampleLine}>{ex.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </>
    );
  }

  return (
    <View style={[styles.screen, screenTopPaddingStyle]}>
      {header}
      <ScrollView
        style={
          mainScrollCentered ? styles.mainScroll : styles.scrollView
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={hasWordContent ? "on-drag" : undefined}
        showsVerticalScrollIndicator={hasWordContent}
        contentContainerStyle={
          mainScrollCentered
            ? styles.mainScrollContentCentered
            : styles.scrollContent
        }
      >
        {scrollInner}
      </ScrollView>
      {footerVisible ? (
        <View style={styles.footer}>
          <Pressable
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => {
              const disabled = hasWordContent
                ? !canAct
                : transportFetchBusy;
              return [
                styles.primaryButton,
                disabled && styles.primaryButtonDisabled,
                primarySolidPressStyle(pressed, disabled),
              ];
            }}
            onPress={async () => {
              if (hasWordContent) {
                const wid =
                  mainPanel.kind === "word"
                    ? mainPanel.details.word_id
                    : undefined;
                logUserAction("button_press", {
                  target: "daily_word_mark_known",
                  wordId: wid ?? "",
                });
                await markKnown();
              } else {
                logUserAction("button_press", {
                  target: "daily_word_retry_fetch",
                });
                void refresh();
              }
            }}
            disabled={hasWordContent ? !canAct : transportFetchBusy}
            accessibilityRole="button"
            accessibilityState={{
              busy: hasWordContent ? isSaving : transportFetchBusy,
              disabled: hasWordContent ? !canAct : transportFetchBusy,
            }}
            accessibilityLabel="I know this word"
          >
            <View style={styles.primaryButtonInner}>
              {(hasWordContent && isSaving) ||
              (!hasWordContent && transportFetchBusy) ? (
                <ActivityIndicator
                  size="small"
                  color={StitchColors.onPrimary}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : null}
              <Text style={styles.primaryButtonText}>I know this word</Text>
            </View>
          </Pressable>
          {markKnownInlineError && !isSaving ? (
            <Text
              style={styles.markKnownInlineToast}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {markKnownInlineError}
            </Text>
          ) : null}
        </View>
      ) : null}
      {achievementModal}
    </View>
  );
}
