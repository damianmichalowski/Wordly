import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { TrackProgressPill } from "@/src/components/ui/TrackProgressPill";
import {
    ANDROID_RIPPLE_ICON_ROUND,
    ANDROID_RIPPLE_PRIMARY,
    HIT_SLOP_MINI,
    primarySolidPressStyle,
    roundIconPressStyle,
} from "@/src/components/ui/interaction";
import { useDailyWord } from "@/src/features/daily-word/hooks/useDailyWord";
import { useLearningTrackProgress } from "@/src/features/daily-word/hooks/useLearningTrackProgress";
import { dailyWordCardStyles as card } from "@/src/features/daily-word/styles/dailyWordCard.styles";
import { groupSensesByPartOfSpeech } from "@/src/features/daily-word/utils/groupSensesByPartOfSpeech";
import { useUserProfileSettings } from "@/src/features/profile/hooks/useUserProfileSettings";
import {
    canPronounce,
    speakWord,
} from "@/src/services/audio/pronunciationService";
import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

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
    fontSize: 24,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  celebrateSubtitle: {
    fontSize: 16,
    fontFamily: StitchFonts.body,
    textAlign: "center",
    color: StitchColors.onSurfaceVariant,
    lineHeight: 24,
    marginTop: 8,
  },
  celebrateHighlight: {
    color: StitchColors.primary,
    fontFamily: StitchFonts.bodySemi,
  },
  celebrateHint: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    textAlign: "center",
    color: StitchColors.onSurfaceVariant,
    lineHeight: 21,
    marginTop: 14,
  },
  actions: {
    marginTop: 4,
    gap: 12,
    width: "100%",
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
});

/** Liczba 2-4 → „słowa”, 1 → „słowo”, reszta → „słów”. */
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

export default function HomeScreen() {
  const router = useRouter();
  const {
    data: trackProgress,
    isLoading: isLoadingTrack,
    refresh: refreshTrackProgress,
  } = useLearningTrackProgress();
  const { isLoading, canAct, markKnown, loadFailed, data, refresh } =
    useDailyWord({ onTrackExhausted: refreshTrackProgress });
  const { data: profileSettings, isLoading: isLoadingProfile } =
    useUserProfileSettings();

  const details = data?.details ?? null;
  const assignment = data?.assignment ?? null;

  const orderedSenses = useMemo(() => {
    const list = details?.senses ?? [];
    if (list.length === 0) {
      return [];
    }
    return [...list].sort((a, b) => a.sense_order - b.sense_order);
  }, [details?.senses]);

  const posGroups = useMemo(
    () => groupSensesByPartOfSpeech(orderedSenses),
    [orderedSenses],
  );

  const firstTranslation = useMemo(
    () => orderedSenses[0]?.translation?.text ?? "",
    [orderedSenses],
  );

  const goToLearningModeSettings = useCallback(() => {
    router.push({
      pathname: "/(tabs)/settings",
      params: { focus: "learningMode" },
    });
  }, [router]);

  const goToRevision = useCallback(() => {
    router.push("/(tabs)/revision");
  }, [router]);

  /** W pigułce zawsze pokazujemy liczbę % (w tym 0%), nie wielokropek zastępczy. */
  const progressPercentForPill = useMemo(() => {
    if (!trackProgress) return null;
    if (trackProgress.availableCount > 0) {
      return trackProgress.progressPercent;
    }
    return 0;
  }, [trackProgress]);

  const trackLabel = useMemo(() => {
    if (!profileSettings) return null;
    if (profileSettings.learning_mode_type === "difficulty") {
      const lvl = profileSettings.learning_level;
      if (!lvl) return "Difficulty";
      return lvl.charAt(0).toUpperCase() + lvl.slice(1);
    }
    return profileSettings.selected_category?.name ?? "Category";
  }, [profileSettings]);

  const nextModeHint = useMemo(() => {
    if (!profileSettings) {
      return "W ustawieniach możesz wybrać inny poziom trudności, kategorię albo tryb nauki.";
    }
    if (profileSettings.learning_mode_type === "difficulty") {
      const lvl = profileSettings.learning_level;
      if (lvl === "beginner") {
        return "W ustawieniach przełącz się na Intermediate albo Advanced albo spróbuj trybu kategorii.";
      }
      if (lvl === "intermediate") {
        return "W ustawieniach wejdź w Advanced lub wybierz kategorię, żeby odkrywać słowa z tematu.";
      }
      if (lvl === "advanced") {
        return "Spróbuj trybu kategorii albo zostaw ten poziom i wracaj do powtórek. Nowe słowa pojawią się po zmianie trybu.";
      }
    }
    return "Wybierz inną kategorię albo przejdź na poziom trudności. W ustawieniach zajmie to chwilę.";
  }, [profileSettings]);

  const isTrackCompleted =
    trackProgress &&
    trackProgress.availableCount > 0 &&
    trackProgress.knownCount >= trackProgress.availableCount;

  const header = (
    <ScreenHeader
      title="Daily word"
      rightAccessory={
        <TrackProgressPill
          isInitialProfileLoading={isLoadingProfile && !profileSettings}
          trackName={trackLabel ?? "…"}
          progressPercent={progressPercentForPill}
          isPercentPending={isLoadingTrack && !trackProgress}
        />
      }
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContentCentered}
          keyboardShouldPersistTaps="handled"
        >
          <ActivityIndicator size="small" color={StitchColors.primary} />
        </ScrollView>
      </View>
    );
  }

  /** Przed `loadFailed`: przy ukończonym torze nie pokazuj chwilowego błędu pobrania (wyścig z `refresh`). */
  if (isTrackCompleted && trackProgress) {
    const n = trackProgress.availableCount;
    const label = trackLabel ?? "…";
    const wordsForm = polishWordsForm(n);

    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContentCentered}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={ZoomIn.duration(420)}>
            <Ionicons
              name="trophy"
              size={64}
              color={StitchColors.secondary}
              style={styles.emptyIcon}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(380).delay(80)}>
            <Text style={styles.celebrateTitle}>Mega robota!</Text>
            <Text style={styles.celebrateSubtitle}>
              Przeszedłeś przez{" "}
              <Text style={styles.celebrateHighlight}>
                {n} {wordsForm}
              </Text>{" "}
              w tym torze (
              <Text style={styles.celebrateHighlight}>{label}</Text>
              ). Tak trzymaj.
            </Text>
            <Text style={styles.celebrateHint}>{nextModeHint}</Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(360).delay(160)}
            style={[styles.actions, { alignSelf: "stretch" }]}
          >
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                styles.primaryButton,
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={goToLearningModeSettings}
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
              onPress={goToRevision}
            >
              <Text style={styles.secondaryButtonText}>
                Przejdź do powtórek
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  /** Brak danych karty bez ukończenia toru: tryby z 0 słów będą blokowane w ustawieniach; tu tylko ten sam ekran co przy błędzie pobrania. */
  if (loadFailed || !details || !assignment) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContentCentered}
          keyboardShouldPersistTaps="handled"
        >
          <Ionicons
            name="cloud-offline-outline"
            size={56}
            color={StitchColors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text style={styles.title}>Nie mogę pobrać słowa dnia</Text>
          <Text style={styles.subtitle}>
            Sprawdź połączenie z internetem (Wi‑Fi lub dane mobilne), potem
            spróbuj ponownie poniżej.
          </Text>

          <View style={styles.actions}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                styles.primaryButton,
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={refresh}
            >
              <Text style={styles.primaryButtonText}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const ipa = details.ipa?.trim();
  const speakPayload = {
    id: details.word_id,
    sourceLanguageCode: details.target_language.code as any,
    targetLanguageCode: (details.senses[0]?.translation.native_language_id ??
      "en") as any,
    sourceText: details.lemma,
    targetText: firstTranslation,
    exampleSource: "",
    exampleTarget: "",
    cefrLevel: (details.cefr.code ?? "A1") as any,
    pronunciationText: details.ipa ?? undefined,
    audioUrl: null,
  };

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        contentContainerStyle={styles.scrollContent}
      >
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
                onPress={() => speakWord(speakPayload as any)}
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
            {details.categories.map((c) => (
              <View key={c.id} style={card.pillCefrCompact}>
                <Text style={card.pillCefrCompactText}>{c.name}</Text>
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
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            !canAct && styles.primaryButtonDisabled,
            primarySolidPressStyle(pressed, !canAct),
          ]}
          onPress={async () => {
            const outcome = await markKnown();
            if (outcome !== "exhausted") {
              void refreshTrackProgress();
            }
          }}
          disabled={!canAct}
        >
          <Text style={styles.primaryButtonText}>I know this word</Text>
        </Pressable>
      </View>
    </View>
  );
}
