import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { CenteredMessageCta } from "@/src/components/ui/CenteredMessageCta";
import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  linkPressStyle,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import { LearnTrackModeSegment } from "@/src/components/ui/LearnTrackModeSegment";
import { progressBarFillPercent } from "@/src/components/ui/LearningTrackOptionRow";
import { TrackModeTile } from "@/src/components/ui/TrackModeTile";
import { WidgetHomePreviewCard } from "@/src/components/ui/WidgetHomePreviewCard";
import { translationLinesForWidget } from "@/src/services/widgets/widgetSurfaceService";
import type { LearningModeType } from "@/src/features/profile/types/profile.types";
import { useDailyWord } from "@/src/features/daily-word/hooks/useDailyWord";
import { getAccountEmailOrName } from "@/src/features/profile/services/profileAccount.service";
import { LanguageFlagBadge } from "@/src/features/settings/components/LanguageFlagBadge";
import { getLearningLevelShortDescription } from "@/src/features/settings/learningLevelCopy";
import { useSettings } from "@/src/features/settings/useSettings";
import { useAppBootstrap } from "@/src/hooks/useAppBootstrap";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { signOutApp } from "@/src/services/auth/socialAuth";
import { clearOnboardingCompletionFlag } from "@/src/services/storage/onboardingStorage";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/** Tolerancja na zaokrąglenia layoutu, poniżej uznajemy, że treść „mieści się”. */
const SCROLL_OVERFLOW_EPS_PX = 2;

type PickerKey = "nativeLanguage" | "learningLanguage" | null;

function formatSince(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

/** Dwie litery: z imienia i nazwiska albo z części lokalnej adresu e-mail (np. jan.kowalski → JK). */
function getProfileInitials(displayName: string): string {
  const s = displayName.trim();
  if (!s) {
    return "W";
  }
  if (s.includes("@")) {
    const local = (s.split("@")[0] ?? "").trim();
    const segments = local.split(/[._\-+]+/).filter(Boolean);
    if (segments.length >= 2) {
      const a = segments[0]?.charAt(0) ?? "";
      const b = segments[segments.length - 1]?.charAt(0) ?? "";
      return `${a}${b}`.toUpperCase() || "W";
    }
    const chunk = (local || "w").slice(0, 2);
    return chunk.toUpperCase();
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0) ?? "";
    const b = parts[parts.length - 1]?.charAt(0) ?? "";
    return `${a}${b}`.toUpperCase();
  }
  const word = parts[0] ?? s;
  if (word.length >= 2) {
    return word.slice(0, 2).toUpperCase();
  }
  return (word.charAt(0) || "W").toUpperCase();
}

function StitchSettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.prefRow,
        pressed && !disabled && styles.prefRowPressed,
        disabled && styles.prefRowDisabled,
      ]}
    >
      <View style={styles.prefRowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={22} color={StitchColors.primary} />
        </View>
        <View style={styles.prefRowText}>
          <Text style={styles.prefTitle}>{title}</Text>
          <Text style={styles.prefSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.prefRowRight}>
        <Text style={styles.prefValue} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={StitchColors.onSurfaceVariant}
        />
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { focus: focusParam } = useLocalSearchParams<{
    focus?: string | string[];
  }>();
  const focus =
    typeof focusParam === "string"
      ? focusParam
      : Array.isArray(focusParam)
        ? focusParam[0]
        : undefined;

  const settingsMainScrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [learningModeSectionY, setLearningModeSectionY] = useState<
    number | null
  >(null);

  const onLearningModeSectionLayout = useCallback((e: LayoutChangeEvent) => {
    setLearningModeSectionY(e.nativeEvent.layout.y);
  }, []);

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  /** Kwadrat jak `systemSmall`: szerokość = wysokość; marginesy scroll (48) + padding ramki podglądu (56). */
  const widgetSquareSize = Math.min(240, Math.max(160, windowWidth - 104));
  const { markOnboardingIncomplete } = useAppBootstrap();
  const {
    isLoading,
    isSaving,
    options,
    optionsProgress,
    settings,
    nativeLanguageId,
    learningLanguageId,
    learningModeType,
    learningLevel,
    selectedCategoryId,
    nativeLanguage,
    learningLanguage,
    canSave,
    error,
    setNativeLanguageId,
    setLearningLanguageId,
    setLearningModeType,
    setLearningLevel,
    setSelectedCategoryId,
    save,
    refresh,
  } = useSettings();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (focus !== "learningMode") return;
    if (isLoading || !settings) return;
    if (learningModeSectionY == null) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        settingsMainScrollRef.current?.scrollTo({
          y: Math.max(0, learningModeSectionY - 16),
          animated: true,
        });
        router.setParams({ focus: undefined });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, isLoading, settings, learningModeSectionY, router]);

  const { data: dailyWord } = useDailyWord();
  const [picker, setPicker] = useState<PickerKey>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  /** Rzeczywista szerokość siatki, dokładnie 2 kolumny: (szerokość − gap) / 2. */
  const [gridInnerWidth, setGridInnerWidth] = useState(0);

  const languagePickerScrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [languagePickerScroll, setLanguagePickerScroll] = useState({
    layoutH: 0,
    contentH: 0,
  });
  const [settingsScroll, setSettingsScroll] = useState({
    layoutH: 0,
    contentH: 0,
  });

  const languagePickerNeedsScroll =
    languagePickerScroll.layoutH > 0 &&
    languagePickerScroll.contentH >
      languagePickerScroll.layoutH + SCROLL_OVERFLOW_EPS_PX;

  const settingsNeedsScroll =
    settingsScroll.layoutH > 0 &&
    settingsScroll.contentH > settingsScroll.layoutH + SCROLL_OVERFLOW_EPS_PX;

  useEffect(() => {
    setLanguagePickerScroll({ layoutH: 0, contentH: 0 });
  }, [picker]);

  useEffect(() => {
    if (!picker || !languagePickerNeedsScroll || Platform.OS !== "ios") {
      return;
    }
    const id = requestAnimationFrame(() => {
      languagePickerScrollRef.current?.flashScrollIndicators();
    });
    return () => cancelAnimationFrame(id);
  }, [picker, languagePickerNeedsScroll]);

  const onLanguagePickerLayout = useCallback((e: LayoutChangeEvent) => {
    const layoutH = e.nativeEvent.layout.height;
    setLanguagePickerScroll((prev) => ({
      ...prev,
      layoutH,
    }));
  }, []);

  const onLanguagePickerContentSizeChange = useCallback(
    (_w: number, h: number) => {
      setLanguagePickerScroll((prev) => ({ ...prev, contentH: h }));
    },
    [],
  );

  const onSettingsScrollLayout = useCallback((e: LayoutChangeEvent) => {
    const layoutH = e.nativeEvent.layout.height;
    setSettingsScroll((prev) => ({
      ...prev,
      layoutH,
    }));
  }, []);

  const onSettingsContentSizeChange = useCallback((_: number, h: number) => {
    setSettingsScroll((prev) => ({ ...prev, contentH: h }));
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      return;
    }
    void (async () => {
      const email = await getAccountEmailOrName();
      setAccountEmail(email);
    })();
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const chipDisabled = isSaving;

  const handleTrackModeChange = useCallback(
    (next: LearningModeType) => {
      if (next === learningModeType) {
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLearningModeType(next);
    },
    [learningModeType, setLearningModeType],
  );

  const nativeName = nativeLanguage?.name ?? "…";
  const learningName = learningLanguage?.name ?? "…";

  const trackProgressMaps = useMemo(() => {
    const difficulty = new Map(
      (optionsProgress?.difficulty ?? []).map((d) => [d.key, d]),
    );
    const categories = new Map(
      (optionsProgress?.categories ?? []).map((c) => [c.id, c]),
    );
    const getPct = (knownCount: number, availableCount: number) =>
      availableCount > 0
        ? Math.round((knownCount / availableCount) * 100)
        : 0;
    return { difficulty, categories, getPct };
  }, [optionsProgress]);

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

  const closePicker = useCallback(() => setPicker(null), []);

  const pickerModal = useMemo(() => {
    if (!picker || !options) {
      return null;
    }

    const title =
      picker === "nativeLanguage" ? "Język ojczysty" : "Język nauki";

    return (
      <Modal
        visible
        animationType="fade"
        transparent
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalIntro}>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <ScrollView
              ref={languagePickerScrollRef}
              style={styles.modalLanguageList}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              onLayout={onLanguagePickerLayout}
              onContentSizeChange={onLanguagePickerContentSizeChange}
              showsVerticalScrollIndicator={languagePickerNeedsScroll}
              persistentScrollbar={
                languagePickerNeedsScroll && Platform.OS === "android"
              }
            >
              {options.languages.map((item) => {
                const selected =
                  picker === "nativeLanguage"
                    ? nativeLanguageId === item.id
                    : learningLanguageId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    disabled={chipDisabled}
                    android_ripple={ANDROID_RIPPLE_SURFACE}
                    style={({ pressed }) => [
                      styles.modalLanguageRow,
                      selected && styles.modalLanguageRowSelected,
                      pressed && !chipDisabled && styles.modalLanguageRowPressed,
                      chipDisabled && styles.prefRowDisabled,
                    ]}
                    onPress={() =>
                      picker === "nativeLanguage"
                        ? setNativeLanguageId(item.id)
                        : setLearningLanguageId(item.id)
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: chipDisabled }}
                    accessibilityLabel={`${item.name}, ${item.code.toUpperCase()}`}
                  >
                    <View style={styles.modalLanguageFlagCell}>
                      <LanguageFlagBadge code={item.code} />
                    </View>
                    <View style={styles.modalLanguageRowText}>
                      <Text style={styles.modalLanguageName}>{item.name}</Text>
                      <Text style={styles.modalLanguageCode}>
                        {item.code.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalLanguageRowTrailing}>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color={StitchColors.primary}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.modalDone,
                linkPressStyle(pressed, false),
              ]}
              onPress={closePicker}
            >
              <Text style={styles.modalDoneText}>Gotowe</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }, [
    picker,
    options,
    closePicker,
    nativeLanguageId,
    learningLanguageId,
    chipDisabled,
    setNativeLanguageId,
    setLearningLanguageId,
    languagePickerNeedsScroll,
    onLanguagePickerLayout,
    onLanguagePickerContentSizeChange,
  ]);

  const widgetPreview = useMemo(() => {
    const word = dailyWord?.details.lemma ?? "Hello";
    const translations = translationLinesForWidget(dailyWord?.details.senses);
    return {
      word,
      translations:
        translations.length > 0 ? translations : ["cześć"],
    };
  }, [dailyWord?.details.lemma, dailyWord?.details.senses]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={StitchColors.primary} />
      </View>
    );
  }

  if (!settings) {
    return (
      <CenteredMessageCta
        variant="settings"
        title="Onboarding required"
        subtitle="Complete onboarding to manage your settings."
        primaryLabel="Go to onboarding"
        onPrimaryPress={() => router.replace("/(onboarding)")}
      />
    );
  }

  const displayName = accountEmail ?? "Wordly learner";
  const since = formatSince(settings.created_at);
  const profileSinceLine =
    since.length > 0 ? `W aplikacji od ${since}` : "";

  return (
    <View style={styles.screen}>
      {pickerModal}
      <ScreenHeader title="Ustawienia" />
      <ScrollView
        ref={settingsMainScrollRef}
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        onLayout={onSettingsScrollLayout}
        onContentSizeChange={onSettingsContentSizeChange}
        showsVerticalScrollIndicator={settingsNeedsScroll}
        persistentScrollbar={
          settingsNeedsScroll && Platform.OS === "android"
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 28 + insets.bottom },
        ]}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text
                style={styles.avatarInitials}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {getProfileInitials(displayName)}
              </Text>
            </View>
          </View>
          <View style={styles.profileTextCol}>
            <Text style={styles.profileName}>{displayName}</Text>
            {profileSinceLine ? (
              <Text style={styles.profileSubtitle}>{profileSinceLine}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionHeading}>Preferencje nauki</Text>
        <View style={styles.listGroupOuter}>
          <View style={styles.listGroupInner}>
            <StitchSettingsRow
              icon="language-outline"
              title="Język ojczysty"
              subtitle="Tłumaczenia i interfejs"
              value={nativeName}
              disabled={chipDisabled}
              onPress={() => setPicker("nativeLanguage")}
            />
            <StitchSettingsRow
              icon="book-outline"
              title="Język nauki"
              subtitle="Język, którego się uczysz"
              value={learningName}
              disabled={chipDisabled}
              onPress={() => setPicker("learningLanguage")}
            />
          </View>
        </View>

        <View
          collapsable={false}
          style={styles.learningModeSection}
          onLayout={onLearningModeSectionLayout}
        >
          <Text
            style={[styles.sectionHeading, styles.sectionHeadingLearningMode]}
          >
            Tryb nauki
          </Text>
          <View style={styles.trackPanelOuter}>
            <LearnTrackModeSegment
              value={learningModeType}
              disabled={chipDisabled}
              onChange={handleTrackModeChange}
            />
            <Animated.View
              key={learningModeType}
              entering={FadeIn.duration(260)}
              style={styles.modeGridWrap}
            >
              <View
                style={styles.modeGrid}
                onLayout={onModeGridLayout}
              >
                {options && learningModeType === "difficulty"
                  ? options.learningLevels.map((lvl) => {
                      const p = trackProgressMaps.difficulty.get(
                        lvl.value as any,
                      );
                      const availableCount = p?.availableCount ?? 0;
                      const knownCount = p?.knownCount ?? 0;
                      const pct = trackProgressMaps.getPct(
                        knownCount,
                        availableCount,
                      );
                      const barFill = progressBarFillPercent(
                        pct,
                        availableCount,
                      );
                      const selected =
                        learningModeType === "difficulty" &&
                        learningLevel === (lvl.value as any);
                      return (
                        <TrackModeTile
                          key={lvl.value}
                          title={lvl.label}
                          description={getLearningLevelShortDescription(
                            lvl.value,
                          )}
                          selected={selected}
                          disabled={chipDisabled}
                          availableCount={availableCount}
                          pct={pct}
                          barFill={barFill}
                          width={modeTileWidth}
                          onPress={() => setLearningLevel(lvl.value as any)}
                        />
                      );
                    })
                  : options?.categories.map((cat) => {
                      const p = trackProgressMaps.categories.get(cat.id);
                      const availableCount = p?.availableCount ?? 0;
                      const knownCount = p?.knownCount ?? 0;
                      const pct = trackProgressMaps.getPct(
                        knownCount,
                        availableCount,
                      );
                      const barFill = progressBarFillPercent(
                        pct,
                        availableCount,
                      );
                      const selected =
                        learningModeType === "category" &&
                        selectedCategoryId === cat.id;
                      return (
                        <TrackModeTile
                          key={cat.id}
                          title={cat.name}
                          description={cat.description}
                          selected={selected}
                          disabled={chipDisabled}
                          availableCount={availableCount}
                          pct={pct}
                          barFill={barFill}
                          width={modeTileWidth}
                          onPress={() => setSelectedCategoryId(cat.id)}
                        />
                      );
                    })}
              </View>
            </Animated.View>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            (!canSave || isSaving) && styles.buttonDisabled,
            primarySolidPressStyle(pressed, !canSave || isSaving),
          ]}
          onPress={save}
          disabled={!canSave || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={StitchColors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Zapisz ustawienia</Text>
          )}
        </Pressable>

        <Text style={styles.sectionHeading}>Widget preview</Text>
        <View style={styles.widgetGrid}>
          <View style={styles.widgetPreviewCanvas}>
            <Text style={styles.widgetPreviewLabel}>Home screen preview</Text>
            <WidgetHomePreviewCard
              word={widgetPreview.word}
              translations={widgetPreview.translations}
              size={widgetSquareSize}
            />
          </View>
          <View style={styles.widgetNote}>
            <View style={styles.widgetRecommendedBanner}>
              <View style={styles.widgetRecommendedBadge}>
                <Text style={styles.widgetRecommendedBadgeText}>Zalecane</Text>
              </View>
              <Text style={styles.widgetNoteLead}>
                Dodaj widżet Wordly na ekran główny, żeby mieć szybki podgląd dzisiejszego słowa bez
                otwierania aplikacji.
              </Text>
            </View>
            <View style={styles.widgetInstructionList}>
              {Platform.OS === "ios" ? (
                <>
                  <View style={styles.widgetInstructionRow}>
                    <Text style={styles.widgetInstructionIndex}>1</Text>
                    <Text style={styles.widgetNoteInstructions}>
                      Na ekranie głównym przytrzymaj pusty fragment pulpitu i wybierz „Edytuj ekran
                      główny”.
                    </Text>
                  </View>
                  <View style={styles.widgetInstructionRow}>
                    <Text style={styles.widgetInstructionIndex}>2</Text>
                    <Text style={styles.widgetNoteInstructions}>
                      Stuknij „+” u góry po lewej.
                    </Text>
                  </View>
                  <View style={styles.widgetInstructionRow}>
                    <Text style={styles.widgetInstructionIndex}>3</Text>
                    <Text style={styles.widgetNoteInstructions}>
                      Wyszukaj Wordly, wybierz rozmiar widżetu i potwierdź „Dodaj widżet”.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.widgetInstructionRow}>
                    <Text style={styles.widgetInstructionIndex}>1</Text>
                    <Text style={styles.widgetNoteInstructions}>
                      Przytrzymaj pusty fragment ekranu głównego.
                    </Text>
                  </View>
                  <View style={styles.widgetInstructionRow}>
                    <Text style={styles.widgetInstructionIndex}>2</Text>
                    <Text style={styles.widgetNoteInstructions}>
                      Otwórz bibliotekę widżetów, znajdź Wordly i dodaj widżet w wybranym rozmiarze.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.accountHeading}>Account Management</Text>
        <View style={styles.accountCard}>
          {hasSupabaseEnv() ? (
            <Pressable
              style={({ pressed }) => [
                styles.accountRow,
                pressed && styles.accountRowPressed,
              ]}
              disabled={chipDisabled}
              onPress={() => {
                Alert.alert(
                  "Wyloguj się",
                  "Zakończysz sesję na tym urządzeniu. Profil lokalny zostanie zachowany. Po ponownym logowaniu odzyskasz postęp.",
                  [
                    { text: "Anuluj", style: "cancel" },
                    {
                      text: "Wyloguj",
                      style: "destructive",
                      onPress: () => {
                        void (async () => {
                          await signOutApp();
                          router.replace("/(onboarding)");
                        })();
                      },
                    },
                  ],
                );
              }}
            >
              <View style={styles.accountRowLeft}>
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={StitchColors.error}
                />
                <Text style={styles.accountRowLabel}>Sign out</Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.accountRow,
              pressed && styles.accountRowPressed,
            ]}
            onPress={() =>
              Alert.alert(
                "Delete account",
                "Account deletion is not available in the app yet. Contact support if you need to remove your data.",
              )
            }
          >
            <View style={styles.accountRowLeft}>
              <Ionicons
                name="trash-outline"
                size={22}
                color={StitchColors.error}
              />
              <Text style={[styles.accountRowLabel, styles.accountRowDanger]}>
                Delete account
              </Text>
            </View>
          </Pressable>
        </View>

        {__DEV__ ? (
          <View style={styles.devBlock}>
            <Text style={styles.devLabel}>Developer</Text>
            <Pressable
              style={styles.devButton}
              onPress={() => {
                Alert.alert(
                  "Reset onboarding",
                  "Clears the onboarding flag and opens the language step. For testing only.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reset",
                      onPress: () => {
                        void (async () => {
                          await clearOnboardingCompletionFlag();
                          markOnboardingIncomplete();
                          router.replace("/(onboarding)/language-pair");
                        })();
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.devButtonText}>Reset onboarding (test)</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

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
    paddingTop: 12,
    gap: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
    backgroundColor: StitchColors.surface,
  },
  profileCard: {
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    padding: 28,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  avatarWrap: {
    alignSelf: "center",
  },
  /** Jeden widok = jedno kółko (bez zagnieżdżonego kwadratu z tłem pod `overflow`). */
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: StitchColors.primaryContainer,
    borderWidth: 3,
    borderColor: "rgba(133, 150, 255, 0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 30,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onPrimaryContainer,
    letterSpacing: 0.5,
    textAlign: "center",
    includeFontPadding: false,
  },
  profileTextCol: {
    width: "100%",
    alignItems: "center",
  },
  profileName: {
    fontSize: 20,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 4,
    textAlign: "center",
  },
  profileSubtitle: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },
  /** Odtwarza `gap` z `scrollContent` między nagłówkiem a panelem (wcześej były osobnymi dziećmi ScrollView). */
  learningModeSection: {
    width: "100%",
    gap: 24,
  },
  trackPanelOuter: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: `${StitchColors.outlineVariant}33`,
  },
  modeGridWrap: {
    marginTop: 2,
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
  sectionHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    paddingHorizontal: 4,
    marginBottom: -8,
  },
  /** W sekcji z `learningModeSection` odstęp do panelu daje `gap`; bez tego `-8` nachodził na segment. */
  sectionHeadingLearningMode: {
    marginBottom: 0,
  },
  listGroupOuter: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 1,
    overflow: "hidden",
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  listGroupInner: {
    gap: 1,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  prefRowPressed: {
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  prefRowDisabled: {
    opacity: 0.45,
  },
  prefRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(68, 86, 186, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  prefRowText: {
    flex: 1,
    minWidth: 0,
  },
  prefTitle: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    marginBottom: 2,
  },
  prefSubtitle: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 16,
  },
  prefRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "42%",
  },
  prefValue: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    textAlign: "right",
    flexShrink: 1,
  },
  error: {
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.error,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 18,
    alignItems: "center",
    width: "100%",
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 17,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  widgetGrid: {
    gap: 16,
  },
  widgetPreviewCanvas: {
    borderRadius: StitchRadius.lg,
    borderWidth: 2,
    borderColor: "rgba(175, 179, 179, 0.35)",
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 28,
    alignItems: "center",
  },
  widgetPreviewLabel: {
    fontSize: 10,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 20,
  },
  widgetNote: {
    paddingHorizontal: 4,
    gap: 12,
  },
  widgetRecommendedBanner: {
    borderRadius: StitchRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(68, 86, 186, 0.09)",
    borderWidth: 1.5,
    borderColor: "rgba(68, 86, 186, 0.38)",
    gap: 10,
  },
  widgetRecommendedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: StitchRadius.full,
    backgroundColor: "rgba(68, 86, 186, 0.18)",
  },
  widgetRecommendedBadgeText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  widgetNoteLead: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    lineHeight: 21,
  },
  widgetInstructionList: {
    gap: 6,
    paddingHorizontal: 10,
  },
  widgetInstructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  widgetInstructionIndex: {
    minWidth: 14,
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    lineHeight: 20,
    textAlign: "right",
    paddingTop: 1,
  },
  widgetNoteInstructions: {
    flex: 1,
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
    paddingVertical: 1,
  },
  accountHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.error,
    paddingHorizontal: 4,
    marginBottom: -8,
  },
  accountCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    padding: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  accountRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: StitchRadius.md,
  },
  accountRowPressed: {
    backgroundColor: "rgba(249, 115, 134, 0.12)",
  },
  accountRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  accountRowLabel: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  accountRowDanger: {
    color: StitchColors.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 25, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 22,
    gap: 18,
    maxWidth: 420,
    alignSelf: "center",
    width: "100%",
  },
  modalIntro: {
    gap: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  modalLanguageList: {
    maxHeight: 340,
    marginHorizontal: -4,
  },
  modalLanguageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: StitchRadius.md,
    gap: 12,
    marginBottom: 4,
  },
  modalLanguageRowSelected: {
    backgroundColor: StitchColors.surfaceContainerLow,
  },
  modalLanguageRowPressed: {
    backgroundColor: StitchColors.surfaceContainer,
  },
  /** Stała szerokość + brak ściskania w `row` (flaga PNG / badge z kodem). */
  modalLanguageFlagCell: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modalLanguageRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  modalLanguageName: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  modalLanguageCode: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  modalLanguageRowTrailing: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDone: {
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  modalDoneText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
  devBlock: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainerHigh,
  },
  devLabel: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  devButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.sm,
    backgroundColor: StitchColors.surfaceContainer,
  },
  devButtonText: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
});
