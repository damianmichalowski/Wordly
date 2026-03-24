import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { FormattedTranslationGlosses } from "@/src/components/vocabulary/FormattedTranslationGlosses";
import { CenteredMessageCta } from "@/src/components/ui/CenteredMessageCta";
import { homeWordCardStyles } from "@/src/features/dailyWord/homeWordCardStyles";
import { useDailyWord } from "@/src/features/dailyWord/useDailyWord";
import {
    canPronounce,
    speakWord,
} from "@/src/services/audio/pronunciationService";
import { fetchExternalUsageExamples } from "@/src/services/examples/externalUsageExamples";
import { sentenceExampleHomeStyles } from "@/src/theme/sentenceExampleStyles";
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
    paddingTop: 12,
    paddingBottom: 36,
    gap: 28,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 10,
    backgroundColor: StitchColors.surface,
  },
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    textAlign: "center",
    color: StitchColors.onSurfaceVariant,
  },
  actions: {
    marginTop: 4,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 18,
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
  skipButton: {
    borderRadius: StitchRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: StitchColors.surfaceContainerHigh,
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  skipButtonText: {
    color: StitchColors.onSurface,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const {
    isLoading,
    isSyncPending,
    showBlockingLoadingUi,
    profile,
    snapshot,
    canAct,
    markKnown,
    skipWord,
  } = useDailyWord();
  const [onlineExamples, setOnlineExamples] = useState<
    { source: string }[] | null
  >(null);
  const [loadingOnlineExamples, setLoadingOnlineExamples] = useState(false);
  const lastLevelAlertKey = useRef<string | null>(null);

  const activeWord = snapshot?.activeWord;

  useEffect(() => {
    setOnlineExamples(null);
    setLoadingOnlineExamples(false);
  }, [activeWord?.id]);

  /** Przykłady z sieci (EN): ładujemy od razu przy słowie bez przykładu w bazie. */
  useEffect(() => {
    if (!activeWord) {
      return;
    }
    if (activeWord.exampleSource?.trim()) {
      setOnlineExamples(null);
      setLoadingOnlineExamples(false);
      return;
    }
    if (activeWord.sourceLanguageCode !== "en") {
      setOnlineExamples(null);
      setLoadingOnlineExamples(false);
      return;
    }
    let cancelled = false;
    setLoadingOnlineExamples(true);
    setOnlineExamples(null);
    void fetchExternalUsageExamples({
      lemma: activeWord.sourceText,
      sourceLanguageCode: activeWord.sourceLanguageCode,
      targetLanguageCode: activeWord.targetLanguageCode,
    }).then((rows) => {
      if (!cancelled) {
        setOnlineExamples(rows);
        setLoadingOnlineExamples(false);
      }
    });
    return () => {
      cancelled = true;
      setLoadingOnlineExamples(false);
    };
  }, [activeWord]);

  useEffect(() => {
    const adv = snapshot?.levelAdvanced;
    if (!adv) {
      return;
    }
    const key = `${adv.from}->${adv.to}`;
    if (lastLevelAlertKey.current === key) {
      return;
    }
    lastLevelAlertKey.current = key;
    Alert.alert(
      "Poziom ukończony",
      `Znasz już wszystkie słowa z poziomu ${adv.from}. Przechodzisz na poziom ${adv.to}.`,
      [{ text: "OK" }],
    );
  }, [snapshot?.levelAdvanced]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={StitchColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <CenteredMessageCta
        variant="home"
        title="Onboarding required"
        subtitle="Complete onboarding to start daily words."
        primaryLabel="Go to onboarding"
        onPrimaryPress={() => router.replace("/(onboarding)")}
      />
    );
  }

  if (!activeWord) {
    const message =
      snapshot?.emptyReason === "onboarding-incomplete"
        ? "Brak aktywnej sesji logowania albo profil nie jest powiązany z kontem. Zaloguj się ponownie."
        : snapshot?.emptyReason === "no-words-for-config"
          ? "Brak słów dla tej pary języków i poziomu w bazie. Możliwy powód to zablokowane zapytanie (np. brak logowania). Sprawdź seed danych w Supabase i ustawienia RLS."
          : snapshot?.emptyReason === "all-words-completed"
            ? profile.displayLevel === "C2"
              ? "Znasz już wszystkie słowa na poziomie C2. Gratulacje!"
              : "Wszystkie słowa z tego poziomu są już znane."
            : "Brak aktywnego słowa.";

    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Brak słowa</Text>
        <Text style={styles.subtitle}>{message}</Text>
        {snapshot?.emptyReason === "onboarding-incomplete" ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/(onboarding)")}
          >
            <Text style={styles.primaryButtonText}>Zaloguj się</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const ipa = activeWord.pronunciationText?.trim();
  /** Blokada tylko dla Known / Skip (kolejka zapisów); audio i szczegóły działają od razu. */
  const isPrimaryActionLocked = isSyncPending;
  /** Sync w tle przy już pokazanym słowie z prefetchu (tylko mini loader na Known, bez pełnego overlay). */
  const showPrimaryMiniSyncLoader =
    isSyncPending && !showBlockingLoadingUi;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Słowo dnia" />
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={homeWordCardStyles.focalShell}>
          <View style={homeWordCardStyles.focalInner}>
            {showBlockingLoadingUi ? (
              <View style={homeWordCardStyles.cardLoadingOverlay}>
                <ActivityIndicator size="large" color={StitchColors.primary} />
                <Text style={homeWordCardStyles.cardLoadingText}>
                  Ładowanie następnego słowa…
                </Text>
              </View>
            ) : null}

            <View style={homeWordCardStyles.focalTopRow}>
              <View style={homeWordCardStyles.levelPill}>
                <Text style={homeWordCardStyles.levelPillText}>
                  {activeWord.cefrLevel}
                </Text>
              </View>
              <View style={homeWordCardStyles.topRowActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Odsłuchaj wymowę"
                  style={[
                    homeWordCardStyles.roundIconButton,
                    !canPronounce(activeWord) && homeWordCardStyles.buttonDisabled,
                  ]}
                  onPress={() => speakWord(activeWord)}
                  disabled={!canPronounce(activeWord)}
                >
                  <Ionicons
                    name="volume-medium"
                    size={22}
                    color={StitchColors.onSurface}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pełne szczegóły słowa"
                  style={homeWordCardStyles.roundIconButton}
                  onPress={() => router.push(`/word/${activeWord.id}`)}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={StitchColors.onSurface}
                  />
                </Pressable>
              </View>
            </View>

            <View style={homeWordCardStyles.wordTranslationBlock}>
              <Text style={homeWordCardStyles.heroWord}>
                {activeWord.sourceText}
              </Text>

              {ipa ? (
                <Text style={homeWordCardStyles.ipa} numberOfLines={2}>
                  /{ipa}/
                </Text>
              ) : null}

              <View style={homeWordCardStyles.translationBlock}>
                <FormattedTranslationGlosses
                  word={activeWord}
                  style={homeWordCardStyles.translation}
                  separatorStyle={homeWordCardStyles.translationSeparator}
                />
              </View>
            </View>

            <View style={sentenceExampleHomeStyles.sectionBlock}>
              <Text style={sentenceExampleHomeStyles.sectionTitle}>
                Przykłady użycia
              </Text>
              {activeWord.exampleSource?.trim() ? (
                <View style={sentenceExampleHomeStyles.exampleLine}>
                  <Text style={sentenceExampleHomeStyles.exampleSource}>
                    {activeWord.exampleSource}
                  </Text>
                </View>
              ) : activeWord.sourceLanguageCode !== "en" ? (
                <Text style={sentenceExampleHomeStyles.mutedHint}>
                  Krótkie przykłady z sieci są dostępne tylko dla słów z języka
                  angielskiego.
                </Text>
              ) : loadingOnlineExamples || onlineExamples === null ? (
                <View style={sentenceExampleHomeStyles.loadingRow}>
                  <ActivityIndicator
                    size="small"
                    color={StitchColors.primary}
                  />
                  <Text style={sentenceExampleHomeStyles.mutedHint}>
                    Szukam przykładów…
                  </Text>
                </View>
              ) : onlineExamples.length > 0 ? (
                onlineExamples.map((ex, i) => (
                  <View
                    key={`ex-${i}`}
                    style={sentenceExampleHomeStyles.exampleLine}
                  >
                    <Text style={sentenceExampleHomeStyles.exampleSource}>
                      {ex.source}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={sentenceExampleHomeStyles.onlineEmpty}>
                  Nie udało się znaleźć krótkich przykładów dla tego słowa.
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[
              styles.primaryButton,
              (!canAct || isPrimaryActionLocked) &&
                homeWordCardStyles.buttonDisabled,
            ]}
            onPress={markKnown}
            disabled={!canAct || isPrimaryActionLocked}
          >
            {showBlockingLoadingUi ? (
              <ActivityIndicator
                size="large"
                color={StitchColors.onPrimary}
              />
            ) : showPrimaryMiniSyncLoader ? (
              <View style={styles.primaryButtonInner}>
                <ActivityIndicator
                  size="small"
                  color={StitchColors.onPrimary}
                />
                <Text style={styles.primaryButtonText}>I know this word</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>I know this word</Text>
            )}
          </Pressable>
          <Pressable
            style={[
              styles.skipButton,
              (!canAct || isPrimaryActionLocked) &&
                homeWordCardStyles.buttonDisabled,
            ]}
            onPress={skipWord}
            disabled={!canAct || isPrimaryActionLocked}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
