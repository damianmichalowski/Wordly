import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";

import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_MUTED,
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_COMFORT,
  HIT_SLOP_MINI,
  primarySolidPressStyle,
  roundIconPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { TransportRetryMessage } from "@/src/components/ui/TransportRetryMessage";
import { homeWordCardStyles } from "@/src/features/daily-word/styles/homeWordCardStyles";
import {
  getRevisionExampleLines,
  getRevisionTranslationLines,
} from "@/src/features/revision/revisionFlashcardBackContent";
import {
  canPronounce,
  speakWord,
} from "@/src/services/audio/pronunciationService";
import { fetchExternalUsageExamples } from "@/src/services/examples/externalUsageExamples";
import {
  SESSION_FLASHCARD_STUCK_MS,
  useStuckLoading,
} from "@/src/hooks/useStuckLoading";
import { StitchColors, StitchRadius } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";
import { LogTag, logger } from "@/src/utils/logger";
import { logUserAction } from "@/src/utils/userActionLog";

import { revisionScreenStyles } from "../revisionScreenStyles";
import { RevisionFlipCard } from "./RevisionFlipCard";

type RevisionFlashcardModeProps = {
  flashDeck: VocabularyWord[];
  index: number;
  activeCard: VocabularyWord | null;
  isFlipped: boolean;
  /** Hub: słowa jeszcze z RPC — ten sam ekran fiszek, środek w stanie ładowania. */
  sessionLoading?: boolean;
  /** Ponowne pobranie talii (po „zawieszeniu” / offline). */
  onRetrySessionLoad?: () => void;
  /** Wyjście z fiszek bez zapisu sesji (biblioteka: wróć do listy; Hub: anuluj sesję). */
  onAbortSession: () => void;
  flip: () => void;
  next: () => void;
  previous: () => void;
  sessionLabel?: string;
  onLastCardContinue?: () => void;
};

export function RevisionFlashcardMode({
  flashDeck,
  index,
  activeCard,
  isFlipped,
  sessionLoading = false,
  onRetrySessionLoad,
  onAbortSession,
  flip,
  next,
  previous,
  sessionLabel,
  onLastCardContinue,
}: RevisionFlashcardModeProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const [onlineExamples, setOnlineExamples] = useState<
    { source: string }[] | null
  >(null);
  const [loadingOnlineExamples, setLoadingOnlineExamples] = useState(false);

  const flipHeight = useMemo(() => {
    const h = Math.round(
      Math.min(Math.max(windowH * 0.54, 300), 460),
    );
    return h;
  }, [windowH]);

  const sessionLoadActive = sessionLoading && flashDeck.length === 0;
  /** Inkrementacja przy „Spróbuj ponownie” — resetuje timer „stuck” i wraca do skeletonu + spinnera. */
  const [sessionLoadAttempt, setSessionLoadAttempt] = useState(0);
  const sessionLoadStuck = useStuckLoading(
    sessionLoadActive,
    SESSION_FLASHCARD_STUCK_MS,
    sessionLoadAttempt,
  );
  const sessionLoadShowsProgressSpinner =
    sessionLoadActive && !sessionLoadStuck;

  useEffect(() => {
    if (!sessionLoadActive) {
      setSessionLoadAttempt(0);
    }
  }, [sessionLoadActive]);

  /** Kierunek animacji talii przy zmianie indeksu (Dalej / Wstecz). */
  const [deckDirection, setDeckDirection] = useState<"next" | "prev">("next");

  const goNextCard = useCallback(() => {
    logUserAction("button_press", { target: "revision_flashcard_next" });
    setDeckDirection("next");
    next();
  }, [next]);

  const goPreviousCard = useCallback(() => {
    logUserAction("button_press", { target: "revision_flashcard_previous" });
    setDeckDirection("prev");
    previous();
  }, [previous]);

  const onFlip = useCallback(() => {
    logUserAction("button_press", { target: "revision_flashcard_flip" });
    flip();
  }, [flip]);

  /** Szybsze przejście, mniejszy „bounce” (wyższy damping / stiffness, karta nie wychodzi poza ekran). */
  const deckEntering = useMemo(
    () =>
      deckDirection === "next"
        ? SlideInRight.springify().damping(32).stiffness(520).mass(0.85)
        : SlideInLeft.springify().damping(32).stiffness(520).mass(0.85),
    [deckDirection],
  );

  const deckExiting = useMemo(
    () =>
      deckDirection === "next"
        ? SlideOutLeft.springify().damping(34).stiffness(560).mass(0.82)
        : SlideOutRight.springify().damping(34).stiffness(560).mass(0.82),
    [deckDirection],
  );

  useEffect(() => {
    setOnlineExamples(null);
    setLoadingOnlineExamples(false);
  }, [activeCard?.id]);

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
    logger.info(
      LogTag.REVISION_SESSION,
      `Background enrichment started (examples, sense_id=${activeCard.id})`,
    );
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

  const revisionTranslationLines = useMemo(() => {
    if (!activeCard) {
      return [] as string[];
    }
    return getRevisionTranslationLines(activeCard);
  }, [activeCard]);

  const revisionExampleLines = useMemo(() => {
    if (!activeCard) {
      return [] as string[];
    }
    return getRevisionExampleLines(activeCard, onlineExamples);
  }, [activeCard, onlineExamples]);

  if (sessionLoading && flashDeck.length === 0) {
    return (
      <View style={revisionScreenStyles.revisionFlashcardScreen}>
        <View
          style={[
            revisionScreenStyles.revisionFlashHeaderInset,
            { paddingTop: insets.top + 10 },
          ]}
        >
          <View style={revisionScreenStyles.flashSessionHeaderStack}>
            <View style={revisionScreenStyles.flashSessionHeaderLine}>
              <Text
                style={[
                  revisionScreenStyles.flashSessionLabel,
                  revisionScreenStyles.flashSessionLabelFlexible,
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {sessionLabel ?? "Powtórka"}
              </Text>
              <Pressable
                android_ripple={ANDROID_RIPPLE_MUTED}
                style={({ pressed }) => [
                  revisionScreenStyles.flashAbortPressable,
                  surfacePressStyle(pressed, false),
                ]}
                onPress={() => {
                  logUserAction("button_press", {
                    target: "revision_flashcard_abort_session",
                  });
                  onAbortSession();
                }}
                hitSlop={HIT_SLOP_COMFORT}
                accessibilityRole="button"
                accessibilityLabel="Anuluj sesję bez zapisywania powtórki"
              >
                <Text style={revisionScreenStyles.flashAbortText}>
                  Anuluj sesję
                </Text>
              </Pressable>
            </View>
            <View style={revisionScreenStyles.flashSessionHeaderLine}>
              <Text style={revisionScreenStyles.flashSessionTitle}>Postęp</Text>
              {sessionLoadShowsProgressSpinner ? (
                <ActivityIndicator size="small" color={StitchColors.primary} />
              ) : null}
            </View>
          </View>
          <View style={revisionScreenStyles.flashSessionHeader}>
            <View style={revisionScreenStyles.progressTrack} />
          </View>
        </View>
        <View style={revisionScreenStyles.flashCardOuter}>
          <View style={revisionScreenStyles.revisionDeckCardWrap}>
            {sessionLoadStuck ? (
              <TransportRetryMessage
                variant="embedded"
                onRetry={() => {
                  logUserAction("button_press", {
                    target: "revision_flashcard_session_load_retry",
                  });
                  setSessionLoadAttempt((n) => n + 1);
                  onRetrySessionLoad?.();
                }}
                isRetrying={false}
              />
            ) : (
              <RevisionSessionCardSkeleton height={flipHeight} />
            )}
          </View>
        </View>
        <View
          style={[
            revisionScreenStyles.flashNavRow,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        />
      </View>
    );
  }

  if (!activeCard || flashDeck.length === 0) {
    return (
      <View
        style={[
          revisionScreenStyles.centered,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={revisionScreenStyles.title}>Brak słów</Text>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            revisionScreenStyles.primaryButton,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={() => {
            logUserAction("button_press", {
              target: "revision_flashcard_abort_empty",
            });
            onAbortSession();
          }}
        >
          <Text style={revisionScreenStyles.primaryButtonText}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  const total = flashDeck.length;
  const current = index + 1;
  const progressRatio = total > 0 ? current / total : 0;
  const isLastCard = current === total;
  const isFirstCard = index === 0;
  const ipa = activeCard.pronunciationText?.trim();

  const audioToolbar = (
    <View style={homeWordCardStyles.focalTopRow}>
      <View style={revisionScreenStyles.revisionFlipToolbarTitle}>
        <View style={homeWordCardStyles.levelPill}>
          <Text style={homeWordCardStyles.levelPillText}>
            {activeCard.cefrLevel}
          </Text>
        </View>
      </View>
      <View style={homeWordCardStyles.topRowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Odsłuchaj wymowę"
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          hitSlop={HIT_SLOP_MINI}
          style={({ pressed }) => [
            homeWordCardStyles.roundIconButton,
            !canPronounce(activeCard) && homeWordCardStyles.buttonDisabled,
            roundIconPressStyle(pressed, !canPronounce(activeCard)),
          ]}
          onPress={() => {
            logUserAction("button_press", {
              target: "revision_flashcard_pronounce",
              wordId: activeCard.id,
            });
            void speakWord(activeCard);
          }}
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
  );

  const frontFace = (
    <View style={revisionScreenStyles.revisionFlipFaceRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odwróć fiszkę"
        onPress={onFlip}
        style={({ pressed }) => [
          homeWordCardStyles.focalShell,
          revisionScreenStyles.revisionFlipShell,
          surfacePressStyle(pressed, false),
        ]}
      >
        <View
          style={[
            homeWordCardStyles.focalInner,
            revisionScreenStyles.revisionWordCardInner,
            revisionScreenStyles.revisionFlashcardFocalCompact,
            revisionScreenStyles.revisionFlipFaceColumn,
          ]}
        >
          {audioToolbar}
          <View style={revisionScreenStyles.revisionFlipTapFrontInner}>
            <View
              style={[
                homeWordCardStyles.wordTranslationBlock,
                revisionScreenStyles.revisionFlipFrontWordNudge,
              ]}
            >
              <Text style={homeWordCardStyles.heroWord}>
                {activeCard.sourceText}
              </Text>
              {ipa ? (
                <Text style={homeWordCardStyles.ipa} numberOfLines={2}>
                  /{ipa}/
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );

  const backFace = (
    <View style={revisionScreenStyles.revisionFlipFaceRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odwróć fiszkę"
        onPress={onFlip}
        style={({ pressed }) => [
          homeWordCardStyles.focalShell,
          revisionScreenStyles.revisionFlipShell,
          surfacePressStyle(pressed, false),
        ]}
      >
        <View
          style={[
            homeWordCardStyles.focalInner,
            revisionScreenStyles.revisionWordCardInner,
            revisionScreenStyles.revisionFlashcardFocalCompact,
            revisionScreenStyles.revisionFlipFaceColumn,
          ]}
        >
          <View style={revisionScreenStyles.revisionFlipBackContentWrap}>
            <View style={revisionScreenStyles.revisionFlashcardBackRoot}>
                {revisionTranslationLines.length > 0 ? (
                  <View style={revisionScreenStyles.revisionFlashcardBackTranslationHero}>
                    <View
                      style={revisionScreenStyles.revisionFlashcardTranslationHeroRow}
                    >
                      {revisionTranslationLines.map((line, i) => {
                        const several = revisionTranslationLines.length > 1;
                        const isLast =
                          i === revisionTranslationLines.length - 1;
                        const withComma = several && !isLast;
                        const display = withComma ? `${line},` : line;
                        return (
                          <Text
                            key={`tr-${i}`}
                            style={
                              revisionScreenStyles.revisionFlashcardTranslationHeroText
                            }
                            numberOfLines={5}
                            accessibilityLabel={display}
                          >
                            {display}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {revisionExampleLines.length > 0 ? (
                  <View style={revisionScreenStyles.revisionFlashcardBackSection}>
                    <Text style={revisionScreenStyles.revisionFlashcardExamplesHeading}>
                      Przykłady
                    </Text>
                    <View style={revisionScreenStyles.revisionFlashcardExampleStack}>
                      {revisionExampleLines.map((line, i) => (
                        <View
                          key={`ex-${i}`}
                          style={revisionScreenStyles.revisionFlashcardExampleLine}
                        >
                          <View
                            style={revisionScreenStyles.revisionFlashcardExampleLineBar}
                          />
                          <Text style={revisionScreenStyles.revisionFlashcardExampleText}>
                            {line}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : activeCard.sourceLanguageCode !== "en" ? (
                  <View style={revisionScreenStyles.revisionFlashcardBackSection}>
                    <Text style={revisionScreenStyles.revisionFlashcardExamplesHeading}>
                      Przykłady
                    </Text>
                    <View style={revisionScreenStyles.revisionFlashcardExampleLine}>
                      <View
                        style={revisionScreenStyles.revisionFlashcardExampleLineBar}
                      />
                      <Text
                        style={[
                          revisionScreenStyles.revisionFlashcardMutedHint,
                          revisionScreenStyles.revisionFlashcardMutedHintInSection,
                        ]}
                      >
                        Krótkie przykłady z sieci są dostępne tylko dla słów z
                        języka angielskiego.
                      </Text>
                    </View>
                  </View>
                ) : loadingOnlineExamples || onlineExamples === null ? (
                  <View style={revisionScreenStyles.revisionFlashcardBackSection}>
                    <Text style={revisionScreenStyles.revisionFlashcardExamplesHeading}>
                      Przykłady
                    </Text>
                    <View style={revisionScreenStyles.revisionFlashcardLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={StitchColors.primary}
                      />
                      <Text style={revisionScreenStyles.revisionFlashcardMutedHint}>
                        Szukam przykładów…
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={revisionScreenStyles.revisionFlashcardBackSection}>
                    <Text style={revisionScreenStyles.revisionFlashcardExamplesHeading}>
                      Przykłady
                    </Text>
                    <View style={revisionScreenStyles.revisionFlashcardExampleLine}>
                      <View
                        style={revisionScreenStyles.revisionFlashcardExampleLineBar}
                      />
                      <Text
                        style={[
                          revisionScreenStyles.revisionFlashcardMutedHint,
                          revisionScreenStyles.revisionFlashcardMutedHintInSection,
                        ]}
                      >
                        Brak krótkich przykładów dla tego słowa.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
          </View>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View style={revisionScreenStyles.revisionFlashcardScreen}>
      <View
        style={[
          revisionScreenStyles.revisionFlashHeaderInset,
          { paddingTop: insets.top + 10 },
        ]}
      >
        <View style={revisionScreenStyles.flashSessionHeaderStack}>
          <View style={revisionScreenStyles.flashSessionHeaderLine}>
            <Text
              style={[
                revisionScreenStyles.flashSessionLabel,
                revisionScreenStyles.flashSessionLabelFlexible,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {sessionLabel ?? "Powtórka"}
            </Text>
            <Pressable
              android_ripple={ANDROID_RIPPLE_MUTED}
              style={({ pressed }) => [
                revisionScreenStyles.flashAbortPressable,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "revision_flashcard_abort_session",
                });
                onAbortSession();
              }}
              hitSlop={HIT_SLOP_COMFORT}
              accessibilityRole="button"
              accessibilityLabel="Anuluj sesję bez zapisywania powtórki"
            >
              <Text style={revisionScreenStyles.flashAbortText}>Anuluj sesję</Text>
            </Pressable>
          </View>
          <View style={revisionScreenStyles.flashSessionHeaderLine}>
            <Text style={revisionScreenStyles.flashSessionTitle}>Postęp</Text>
            <View style={revisionScreenStyles.flashSessionCountWrap}>
              <Text>
                <Text style={revisionScreenStyles.flashSessionCountCurrent}>{current}</Text>
                <Text style={revisionScreenStyles.flashSessionCountRest}> z {total}</Text>
              </Text>
            </View>
          </View>
        </View>
        <View style={revisionScreenStyles.flashSessionHeader}>
          <View style={revisionScreenStyles.progressTrack}>
            <View
              style={[
                revisionScreenStyles.progressFill,
                { width: `${progressRatio * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={revisionScreenStyles.flashCardOuter}>
        <Animated.View
          key={activeCard.id}
          entering={deckEntering}
          exiting={deckExiting}
          style={revisionScreenStyles.revisionDeckCardWrap}
        >
          <RevisionFlipCard
            cardKey={activeCard.id}
            isFlipped={isFlipped}
            height={flipHeight}
            front={frontFace}
            back={backFace}
          />
        </Animated.View>
      </View>

      <View
        style={[
          revisionScreenStyles.flashNavRow,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            revisionScreenStyles.flashNavButton,
            revisionScreenStyles.flashNavPrev,
            isFirstCard && revisionScreenStyles.flashNavPrevDisabled,
            surfacePressStyle(pressed, isFirstCard),
          ]}
          onPress={goPreviousCard}
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
          <Text style={revisionScreenStyles.flashNavPrevText}>Wstecz</Text>
        </Pressable>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            revisionScreenStyles.flashNavButton,
            revisionScreenStyles.flashNavNext,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={() => {
            if (isLastCard) {
              logUserAction("button_press", {
                target: "revision_flashcard_finish_session",
              });
              const fn = onLastCardContinue ?? onAbortSession;
              fn();
              return;
            }
            goNextCard();
          }}
          accessibilityLabel={
            isLastCard ? "Zakończ sesję powtórki" : "Następne słowo"
          }
        >
          <Text style={revisionScreenStyles.flashNavNextText}>
            {isLastCard ? "Zakończ" : "Dalej"}
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

function RevisionSessionCardSkeleton({ height }: { height: number }) {
  return (
    <View style={[sessionSkelStyles.root, { height }]}>
      <View style={sessionSkelStyles.shell}>
        <View style={sessionSkelStyles.inner}>
          <View style={sessionSkelStyles.topRow}>
            <View style={sessionSkelStyles.pill} />
            <View style={sessionSkelStyles.round} />
          </View>
          <View style={sessionSkelStyles.lineLg} />
          <View style={sessionSkelStyles.lineMd} />
          <View style={sessionSkelStyles.lineSm} />
        </View>
      </View>
    </View>
  );
}

const sessionSkelStyles = StyleSheet.create({
  root: {
    width: "100%",
    justifyContent: "center",
  },
  shell: {
    borderRadius: StitchRadius.md,
    padding: 4,
    backgroundColor: StitchColors.surface,
    flex: 1,
    minHeight: 0,
  },
  inner: {
    borderRadius: StitchRadius.lg,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
    backgroundColor: StitchColors.surfaceContainerLowest,
    flex: 1,
    justifyContent: "flex-start",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pill: {
    width: 56,
    height: 22,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  lineLg: {
    height: 28,
    width: "88%",
    borderRadius: 6,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  lineMd: {
    height: 18,
    width: "62%",
    borderRadius: 4,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  lineSm: {
    height: 14,
    width: "44%",
    borderRadius: 4,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
});
