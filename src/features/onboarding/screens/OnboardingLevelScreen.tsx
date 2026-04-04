import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LearnTrackModeSegment } from "@/src/components/ui/LearnTrackModeSegment";
import { TrackModeTile } from "@/src/components/ui/TrackModeTile";
import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import { OnboardingStepChrome } from "@/src/features/onboarding/components/OnboardingStepChrome";
import { useOnboardingDraft } from "@/src/features/onboarding/OnboardingProvider";
import type { LearningOptionCatalogCounts } from "@/src/features/profile/services/learningProgress.service";
import { getLearningOptionCatalogCounts } from "@/src/features/profile/services/learningProgress.service";
import { getOnboardingOptions } from "@/src/features/profile/services/profile.service";
import { getLearningLevelShortDescription } from "@/src/features/settings/learningLevelCopy";
import type {
  LearningLevel,
  LearningModeType,
  OnboardingOptions,
} from "@/src/features/profile/types/profile.types";
import { StitchColors, StitchFonts, StitchRadius } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

export default function OnboardingLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [gridInnerWidth, setGridInnerWidth] = useState(0);

  const {
    draft,
    setLearningModeType,
    setLearningLevel,
    setSelectedCategoryId,
  } = useOnboardingDraft();
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [catalogCounts, setCatalogCounts] =
    useState<LearningOptionCatalogCounts | null>(null);

  const catalogCountMaps = useMemo(() => {
    const difficulty = new Map(
      (catalogCounts?.difficulty ?? []).map((d) => [d.key, d.availableCount]),
    );
    const categories = new Map(
      (catalogCounts?.categories ?? []).map((c) => [c.id, c.availableCount]),
    );
    return { difficulty, categories };
  }, [catalogCounts]);

  const TILE_GAP = 12;

  const modeTileWidth = useMemo(() => {
    if (gridInnerWidth > 0) {
      return Math.max(1, Math.floor((gridInnerWidth - TILE_GAP) / 2));
    }
    const inner = windowWidth - 48 - 32;
    return Math.max(1, Math.floor((inner - TILE_GAP) / 2));
  }, [gridInnerWidth, windowWidth]);

  const onModeGridLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setGridInnerWidth(Math.round(w));
    }
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [opts, counts] = await Promise.all([
        getOnboardingOptions(),
        getLearningOptionCatalogCounts().catch(() => null),
      ]);
      if (cancelled) {
        return;
      }
      setOptions(opts);
      setCatalogCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Domyślny poziom po wejściu w tryb „Poziom” / powrót z kategorii (jak pierwszy kafelek). */
  useEffect(() => {
    if (!options) {
      return;
    }
    if (draft.learningModeType !== "difficulty") {
      return;
    }
    if (draft.learningLevel) {
      return;
    }
    const first = options.learningLevels[0]?.value as LearningLevel | undefined;
    if (first) {
      setLearningLevel(first);
    }
  }, [
    draft.learningLevel,
    draft.learningModeType,
    options,
    setLearningLevel,
  ]);

  const handleTrackModeChange = useCallback(
    (next: LearningModeType) => {
      if (next === draft.learningModeType) {
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (next === "difficulty") {
        setSelectedCategoryId(null);
      } else {
        setLearningLevel(null);
      }
      setLearningModeType(next);
    },
    [
      draft.learningModeType,
      setLearningLevel,
      setLearningModeType,
      setSelectedCategoryId,
    ],
  );

  const learningLanguageName = useMemo(() => {
    const lang = options?.languages.find(
      (l) => l.id === draft.learningLanguageId,
    );
    return lang?.name ?? "wybrany język";
  }, [draft.learningLanguageId, options?.languages]);

  const canContinue =
    !!draft.nativeLanguageId &&
    !!draft.learningLanguageId &&
    draft.nativeLanguageId !== draft.learningLanguageId &&
    (draft.learningModeType === "difficulty"
      ? !!draft.learningLevel
      : !!draft.selectedCategoryId);

  return (
    <OnboardingStepChrome step={2} totalSteps={3}>
      <View style={styles.body}>
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollInner}
        >
          <View style={styles.headBlock}>
            <Text style={styles.kicker}>Dopasuj naukę</Text>
            <Text style={styles.title}>
              Jak chcesz uczyć się{" "}
              <Text style={styles.titleAccent}>{learningLanguageName}</Text>?
            </Text>
            <Text style={styles.lead}>
              <Text style={styles.leadEmphasis}>Poziom</Text>
              {
                ": słowa i kolejność nauki są dopasowane do wybranej trudności. "
              }
              <Text style={styles.leadEmphasis}>Kategoria</Text>
              {
                ": uczysz się słownictwa z jednej dziedziny; dobór nie jest już uzależniony od poziomu."
              }
            </Text>
          </View>

          <View style={styles.modeSection}>
            <Text style={styles.sectionHeading}>Tryb nauki</Text>
            <View style={styles.trackPanelOuter}>
            <LearnTrackModeSegment
              value={draft.learningModeType}
              onChange={handleTrackModeChange}
            />
            <Animated.View
              key={draft.learningModeType}
              entering={FadeIn.duration(260)}
              style={styles.modeGridWrap}
            >
              <View style={styles.modeGrid} onLayout={onModeGridLayout}>
                {options && draft.learningModeType === "difficulty"
                  ? options.learningLevels.map((lvl) => {
                      const availableCount =
                        catalogCountMaps.difficulty.get(
                          lvl.value as LearningLevel,
                        ) ?? 0;
                      const selected =
                        draft.learningModeType === "difficulty" &&
                        draft.learningLevel === (lvl.value as LearningLevel);
                      return (
                        <TrackModeTile
                          key={lvl.value}
                          title={lvl.label}
                          description={getLearningLevelShortDescription(
                            lvl.value,
                          )}
                          selected={selected}
                          disabled={false}
                          availableCount={availableCount}
                          pct={0}
                          barFill={0}
                          width={modeTileWidth}
                          showLearningProgress={false}
                          onPress={() => {
                            logUserAction("tile_press", {
                              target: "onboarding_learning_level",
                              level: String(lvl.value),
                            });
                            setLearningLevel(lvl.value as LearningLevel);
                          }}
                        />
                      );
                    })
                  : options?.categories.map((cat) => {
                      const availableCount =
                        catalogCountMaps.categories.get(cat.id) ?? 0;
                      const selected =
                        draft.learningModeType === "category" &&
                        draft.selectedCategoryId === cat.id;
                      return (
                        <TrackModeTile
                          key={cat.id}
                          title={cat.name}
                          description={cat.description}
                          selected={selected}
                          disabled={false}
                          availableCount={availableCount}
                          pct={0}
                          barFill={0}
                          width={modeTileWidth}
                          showLearningProgress={false}
                          onPress={() => {
                            logUserAction("tile_press", {
                              target: "onboarding_learning_category",
                              categoryId: cat.id,
                            });
                            setSelectedCategoryId(cat.id);
                          }}
                        />
                      );
                    })}
              </View>
            </Animated.View>
            </View>
          </View>
        </ScrollView>

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              marginBottom: Math.max(insets.bottom, 16),
            },
            !canContinue && styles.primaryButtonDisabled,
            primarySolidPressStyle(pressed, !canContinue),
          ]}
          onPress={() => {
            logUserAction("button_press", {
              target: "onboarding_continue_to_widget",
            });
            router.push("/(onboarding)/widget");
          }}
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Dalej</Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={StitchColors.onPrimary}
          />
        </Pressable>
      </View>
    </OnboardingStepChrome>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    paddingTop: 6,
    paddingBottom: 20,
  },
  headBlock: {
    gap: 14,
    marginBottom: 26,
    paddingRight: 2,
  },
  kicker: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.5,
  },
  titleAccent: {
    fontStyle: "italic",
    color: StitchColors.secondary,
  },
  lead: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: -0.1,
  },
  leadEmphasis: {
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  modeSection: {
    width: "100%",
    gap: 14,
  },
  /** Jak ustawienia: `sectionHeading` + `trackPanelOuter`. */
  sectionHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    paddingHorizontal: 4,
    marginBottom: 0,
  },
  trackPanelOuter: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 16,
    gap: 18,
    borderWidth: 1,
    borderColor: `${StitchColors.outlineVariant}33`,
  },
  modeGridWrap: {
    marginTop: 0,
    width: "100%",
  },
  modeGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 12,
    alignContent: "flex-start",
    justifyContent: "flex-start",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.headline,
    fontSize: 18,
    fontWeight: "700",
  },
});
