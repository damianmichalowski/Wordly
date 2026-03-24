import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormattedTranslationGlosses } from "@/src/components/vocabulary/FormattedTranslationGlosses";
import { homeWordCardStyles } from "@/src/features/dailyWord/homeWordCardStyles";
import {
  canPronounce,
  speakWord,
} from "@/src/services/audio/pronunciationService";
import { fetchExternalUsageExamples } from "@/src/services/examples/externalUsageExamples";
import { sentenceExampleHomeStyles } from "@/src/theme/sentenceExampleStyles";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";

import { revisionScreenStyles as styles } from "../revisionScreenStyles";

type RevisionFlashcardModeProps = {
  flashDeck: VocabularyWord[];
  index: number;
  activeCard: VocabularyWord | null;
  isFlipped: boolean;
  exitFlashcards: () => void;
  flip: () => void;
  next: () => void;
  previous: () => void;
  /** Krótka etykieta trybu zamiast ogólnego „Powtórka”. */
  sessionLabel?: string;
};

/** `isFlipped` w stanie = tłumaczenie jest odsłonięte (reveal), bez „obracania” fiszki. */
export function RevisionFlashcardMode({
  flashDeck,
  index,
  activeCard,
  isFlipped,
  exitFlashcards,
  flip,
  next,
  previous,
  sessionLabel,
}: RevisionFlashcardModeProps) {
  const insets = useSafeAreaInsets();
  const [onlineExamples, setOnlineExamples] = useState<
    { source: string }[] | null
  >(null);
  const [loadingOnlineExamples, setLoadingOnlineExamples] = useState(false);

  useEffect(() => {
    setOnlineExamples(null);
    setLoadingOnlineExamples(false);
  }, [activeCard?.id]);

  /** Jak na Home: przykłady z sieci (EN), gdy brak exampleSource w bazie. */
  useEffect(() => {
    if (!activeCard) {
      return;
    }
    if (activeCard.exampleSource?.trim()) {
      setOnlineExamples(null);
      setLoadingOnlineExamples(false);
      return;
    }
    if (activeCard.sourceLanguageCode !== "en") {
      setOnlineExamples(null);
      setLoadingOnlineExamples(false);
      return;
    }
    let cancelled = false;
    setLoadingOnlineExamples(true);
    setOnlineExamples(null);
    void fetchExternalUsageExamples({
      lemma: activeCard.sourceText,
      sourceLanguageCode: activeCard.sourceLanguageCode,
      targetLanguageCode: activeCard.targetLanguageCode,
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
  }, [activeCard]);

  if (!activeCard || flashDeck.length === 0) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.title}>Brak słów</Text>
        <Pressable style={styles.primaryButton} onPress={exitFlashcards}>
          <Text style={styles.primaryButtonText}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  const total = flashDeck.length;
  const current = index + 1;
  const progressRatio = total > 0 ? current / total : 0;
  const isLastCard = current === total;
  const isFirstCard = index === 0;
  const translationRevealed = isFlipped;
  const ipa = activeCard.pronunciationText?.trim();

  return (
    <View style={styles.revisionFlashcardScreen}>
      <View
        style={[
          styles.revisionFlashHeaderInset,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View style={styles.flashSessionHeader}>
          <View style={styles.flashSessionHeadingBlock}>
            <Text style={styles.flashSessionLabel}>
              {sessionLabel ?? "Powtórka"}
            </Text>
            <View style={styles.flashSessionTitleRow}>
              <View style={styles.flashSessionTitleWithCount}>
                <Text style={styles.flashSessionTitle}>Postęp</Text>
                <Text>
                  <Text style={styles.flashSessionCountCurrent}>{current}</Text>
                  <Text style={styles.flashSessionCountRest}> z {total}</Text>
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressRatio * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.flashCardOuter}>
        <ScrollView
          style={styles.revisionRevealScroll}
          contentContainerStyle={styles.revisionRevealScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces
        >
          <View style={homeWordCardStyles.focalShell}>
            <View
              style={[
                homeWordCardStyles.focalInner,
                styles.revisionWordCardInner,
              ]}
            >
              <View style={homeWordCardStyles.focalTopRow}>
                <View style={homeWordCardStyles.levelPill}>
                  <Text style={homeWordCardStyles.levelPillText}>
                    {activeCard.cefrLevel}
                  </Text>
                </View>
                <View style={homeWordCardStyles.topRowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Odsłuchaj wymowę"
                    style={[
                      homeWordCardStyles.roundIconButton,
                      !canPronounce(activeCard) &&
                        homeWordCardStyles.buttonDisabled,
                    ]}
                    onPress={() => speakWord(activeCard)}
                    disabled={!canPronounce(activeCard)}
                  >
                    <Ionicons
                      name="volume-medium"
                      size={22}
                      color={StitchColors.onSurface}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={homeWordCardStyles.wordTranslationBlock}>
                <Text style={homeWordCardStyles.heroWord}>
                  {activeCard.sourceText}
                </Text>

                {ipa ? (
                  <Text style={homeWordCardStyles.ipa} numberOfLines={2}>
                    /{ipa}/
                  </Text>
                ) : null}

                {!translationRevealed ? (
                  <Pressable
                    style={styles.revealTranslationPrimary}
                    onPress={flip}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Pokaż tłumaczenie"
                  >
                    <Ionicons
                      name="eye-outline"
                      size={22}
                      color={StitchColors.onPrimary}
                    />
                    <Text style={styles.revealTranslationPrimaryText}>
                      Pokaż tłumaczenie
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <View style={homeWordCardStyles.translationBlock}>
                      <FormattedTranslationGlosses
                        word={activeCard}
                        style={homeWordCardStyles.translation}
                        separatorStyle={homeWordCardStyles.translationSeparator}
                      />
                    </View>

                    <View style={sentenceExampleHomeStyles.sectionBlock}>
                      <Text style={sentenceExampleHomeStyles.sectionTitle}>
                        Przykłady użycia
                      </Text>
                      {activeCard.exampleSource?.trim() ? (
                        <View style={sentenceExampleHomeStyles.exampleLine}>
                          <Text style={sentenceExampleHomeStyles.exampleSource}>
                            {activeCard.exampleSource}
                          </Text>
                        </View>
                      ) : activeCard.sourceLanguageCode !== "en" ? (
                        <Text style={sentenceExampleHomeStyles.mutedHint}>
                          Krótkie przykłady z sieci są dostępne tylko dla słów z
                          języka angielskiego.
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
                            <Text
                              style={sentenceExampleHomeStyles.exampleSource}
                            >
                              {ex.source}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={sentenceExampleHomeStyles.onlineEmpty}>
                          Nie udało się znaleźć krótkich przykładów dla tego
                          słowa.
                        </Text>
                      )}
                    </View>

                    <Pressable
                      style={styles.revealHideLink}
                      onPress={flip}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Ukryj tłumaczenie"
                    >
                      <Text style={styles.revealHideLinkText}>
                        Ukryj tłumaczenie
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View
        style={[
          styles.flashNavRow,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          style={styles.flashNavClose}
          onPress={exitFlashcards}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Zamknij powtórkę"
        >
          <Ionicons name="close" size={24} color={StitchColors.error} />
        </Pressable>
        <Pressable
          style={[
            styles.flashNavButton,
            styles.flashNavPrev,
            isFirstCard && styles.flashNavPrevDisabled,
          ]}
          onPress={previous}
          disabled={isFirstCard}
          accessibilityRole="button"
          accessibilityState={{ disabled: isFirstCard }}
          accessibilityLabel="Poprzednie słowo"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={StitchColors.onSurfaceVariant}
          />
          <Text style={styles.flashNavPrevText}>Wstecz</Text>
        </Pressable>
        <Pressable
          style={[styles.flashNavButton, styles.flashNavNext]}
          onPress={isLastCard ? exitFlashcards : next}
          accessibilityLabel={
            isLastCard ? "Zakończ sesję powtórki" : "Następne słowo"
          }
        >
          <Text style={styles.flashNavNextText}>
            {isLastCard ? "Koniec" : "Dalej"}
          </Text>
          <Ionicons
            name={isLastCard ? "checkmark-circle" : "chevron-forward"}
            size={22}
            color={StitchColors.onPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}
