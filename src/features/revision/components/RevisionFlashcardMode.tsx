import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
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
import { WordDifficultInteractiveBadge } from "@/src/components/word/WordDifficultInteractiveBadge";
import { WordReportEntry } from "@/src/features/word-details/components/WordReportEntry";
import { homeWordCardStyles } from "@/src/features/daily-word/styles/homeWordCardStyles";
import {
  getRevisionExampleLines,
  getRevisionTranslationLines,
} from "@/src/features/revision/revisionFlashcardBackContent";
import {
  canPronounce,
  speakWord,
} from "@/src/services/audio/pronunciationService";
import { StitchColors, StitchRadius } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";
import { logUserAction } from "@/src/utils/userActionLog";

import { revisionScreenStyles } from "../revisionScreenStyles";
import {
  RevisionFlipCard,
  type RevisionFlipDirection,
} from "./RevisionFlipCard";

export type RevisionFlashcardVariant = "default" | "difficultWords";

type RevisionFlashcardModeProps = {
  flashDeck: VocabularyWord[];
  index: number;
  activeCard: VocabularyWord | null;
  isFlipped: boolean;
  /** Hub: słowa jeszcze z RPC — ten sam ekran fiszek, środek w stanie ładowania. */
  sessionLoading?: boolean;
  /** Ponowne pobranie talii (po „zawieszeniu” / offline). */
  onRetrySessionLoad?: () => void;
  /** Otwiera potwierdzenie zakończenia sesji (Hub) lub wyjście bez zapisu (biblioteka). */
  onEndSession: () => void;
  flip: (direction?: RevisionFlipDirection) => void;
  lastFlipDirection: RevisionFlipDirection;
  submitFlashcardKnow: () => Promise<"advanced" | "complete">;
  submitFlashcardDontKnow: () => Promise<"advanced" | "complete">;
  undoFlashcardAnswer: () => Promise<void>;
  canUndoFlashcard: boolean;
  sessionLabel?: string;
  /** Daily Review started offline — nie zapisuje serii; subtelna pigułka w nagłówku. */
  offlineDailyNoStreak?: boolean;
  onLastCardContinue?: () => void;
  flashcardVariant?: RevisionFlashcardVariant;
  difficultDisplayStreak?: number;
  difficultSessionAnswerError?: string | null;
};

export function RevisionFlashcardMode({
  flashDeck,
  index,
  activeCard,
  isFlipped,
  sessionLoading = false,
  onRetrySessionLoad,
  onEndSession,
  flip,
  lastFlipDirection,
  submitFlashcardKnow,
  submitFlashcardDontKnow,
  undoFlashcardAnswer,
  canUndoFlashcard,
  sessionLabel,
  offlineDailyNoStreak = false,
  onLastCardContinue,
  flashcardVariant = "default",
  difficultDisplayStreak = 0,
  difficultSessionAnswerError = null,
}: RevisionFlashcardModeProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDifficultMode = flashcardVariant === "difficultWords";
  const { height: windowH } = useWindowDimensions();

  const flipHeight = useMemo(() => {
    const h = Math.round(
      Math.min(Math.max(windowH * 0.54, 300), 460),
    );
    return h;
  }, [windowH]);

  /** Kierunek karuzeli z delty indeksu (musi być sync przy renderze, przed animacją). */
  const prevDeckIndexRef = useRef(index);
  const deckDirectionRef = useRef<"next" | "prev">("next");
  if (index !== prevDeckIndexRef.current) {
    deckDirectionRef.current =
      index > prevDeckIndexRef.current ? "next" : "prev";
    prevDeckIndexRef.current = index;
  }
  const deckDirection = deckDirectionRef.current;

  const cardWidthRef = useRef(0);

  const onCardLayout = useCallback((event: LayoutChangeEvent) => {
    cardWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const onFlipPress = useCallback(
    (event: GestureResponderEvent) => {
      const width = cardWidthRef.current;
      const x = event.nativeEvent.locationX;
      const tapSide: RevisionFlipDirection =
        width > 0 && x < width / 2 ? -1 : 1;
      const direction = (
        isFlipped ? -tapSide : tapSide
      ) as RevisionFlipDirection;
      logUserAction("button_press", {
        target: "revision_flashcard_flip",
        direction: direction === 1 ? "right" : "left",
      });
      flip(direction);
    },
    [flip, isFlipped],
  );

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
    return getRevisionExampleLines(activeCard);
  }, [activeCard]);

  const handleKnowPress = useCallback(() => {
    void (async () => {
      const result = await submitFlashcardKnow();
      if (result === "complete") {
        logUserAction("button_press", {
          target: "revision_flashcard_finish_session",
        });
        (onLastCardContinue ?? onEndSession)();
      }
    })();
  }, [onEndSession, onLastCardContinue, submitFlashcardKnow]);

  const handleDontKnowPress = useCallback(() => {
    void (async () => {
      const result = await submitFlashcardDontKnow();
      if (result === "complete") {
        logUserAction("button_press", {
          target: "revision_flashcard_finish_session",
        });
        (onLastCardContinue ?? onEndSession)();
      }
    })();
  }, [onEndSession, onLastCardContinue, submitFlashcardDontKnow]);

  const handleUndoPress = useCallback(() => {
    if (!canUndoFlashcard) {
      return;
    }
    void undoFlashcardAnswer();
  }, [canUndoFlashcard, undoFlashcardAnswer]);

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
              <View style={revisionScreenStyles.flashSessionLabelWithBadgeRow}>
                <Text
                  style={[
                    revisionScreenStyles.flashSessionLabel,
                    { flex: 1, minWidth: 0 },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {sessionLabel ?? "Powtórka"}
                </Text>
                {offlineDailyNoStreak ? (
                  <View style={revisionScreenStyles.flashSessionOfflinePill}>
                    <Text style={revisionScreenStyles.flashSessionOfflinePillText}>
                      Offline
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                android_ripple={ANDROID_RIPPLE_MUTED}
                style={({ pressed }) => [
                  revisionScreenStyles.flashEndSessionButton,
                  surfacePressStyle(pressed, false),
                ]}
                onPress={() => {
                  logUserAction("button_press", {
                    target: "revision_flashcard_end_session",
                  });
                  onEndSession();
                }}
                hitSlop={HIT_SLOP_COMFORT}
                accessibilityRole="button"
                accessibilityLabel={t("revision.hub.endSessionA11y")}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={StitchColors.onSurfaceVariant}
                />
                <Text style={revisionScreenStyles.flashEndSessionText}>
                  {t("revision.hub.endSession")}
                </Text>
              </Pressable>
            </View>
            <View style={revisionScreenStyles.flashSessionHeaderLine}>
              <Text style={revisionScreenStyles.flashSessionTitle}>Postęp</Text>
            </View>
          </View>
          <View style={revisionScreenStyles.flashSessionHeader}>
            <View style={revisionScreenStyles.progressTrack} />
          </View>
        </View>
        <View style={revisionScreenStyles.flashCardOuter}>
          <View style={revisionScreenStyles.revisionDeckCardWrap}>
            <RevisionSessionCardSkeleton height={flipHeight} />
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
            onEndSession();
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
  const ipa = activeCard.pronunciationText?.trim();

  const audioToolbar = (
    <View style={homeWordCardStyles.focalTopRow}>
      <View style={revisionScreenStyles.revisionFlipToolbarTitle}>
        <View style={homeWordCardStyles.badgeRow}>
          <View style={homeWordCardStyles.levelPill}>
            <Text style={homeWordCardStyles.levelPillText}>
              {activeCard.cefrLevel}
            </Text>
          </View>
          {(activeCard.categories ?? []).map((category) => (
            <View key={category.id} style={homeWordCardStyles.levelPill}>
              <Text style={homeWordCardStyles.levelPillText}>
                {category.name}
              </Text>
            </View>
          ))}
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

  const flashcardReportEntry = (
    <WordReportEntry
      wordId={activeCard.id}
      lemma={activeCard.sourceText}
      variant="flashcardCorner"
      logOpenTarget="revision_flashcard_report_open"
    />
  );

  const flashcardFooter = (
    <View style={revisionScreenStyles.flashcardBottomBar}>
      {isDifficultMode ? (
        <WordDifficultInteractiveBadge
          variant="mastery"
          wordId={activeCard.id}
          masteryStreak={difficultDisplayStreak}
        />
      ) : (
        <WordDifficultInteractiveBadge
          variant="difficult"
          wordId={activeCard.id}
          isDifficult={activeCard.isDifficult === true}
          dontKnowCounter={activeCard.difficultDontKnowCounter ?? 0}
        />
      )}
      {flashcardReportEntry}
    </View>
  );

  const frontFace = (
    <View style={revisionScreenStyles.revisionFlipFaceRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odwróć fiszkę"
        onPress={onFlipPress}
        onLayout={onCardLayout}
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
              <Text
                style={[
                  homeWordCardStyles.heroWord,
                  revisionScreenStyles.revisionFlashcardHeroWord,
                ]}
              >
                {activeCard.sourceText}
              </Text>
              {ipa ? (
                <Text style={homeWordCardStyles.ipa} numberOfLines={2}>
                  /{ipa}/
                </Text>
              ) : null}
            </View>
          </View>
          {flashcardFooter}
        </View>
      </Pressable>
    </View>
  );

  const backFace = (
    <View style={revisionScreenStyles.revisionFlipFaceRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odwróć fiszkę"
        onPress={onFlipPress}
        onLayout={onCardLayout}
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
                ) : null}
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
            <View style={revisionScreenStyles.flashSessionLabelWithBadgeRow}>
              <Text
                style={[
                  revisionScreenStyles.flashSessionLabel,
                  { flex: 1, minWidth: 0 },
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {sessionLabel ?? "Powtórka"}
              </Text>
              {offlineDailyNoStreak ? (
                <View style={revisionScreenStyles.flashSessionOfflinePill}>
                  <Text style={revisionScreenStyles.flashSessionOfflinePillText}>
                    Offline
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              android_ripple={ANDROID_RIPPLE_MUTED}
              style={({ pressed }) => [
                revisionScreenStyles.flashEndSessionButton,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "revision_flashcard_end_session",
                });
                onEndSession();
              }}
              hitSlop={HIT_SLOP_COMFORT}
              accessibilityRole="button"
              accessibilityLabel={t("revision.hub.endSessionA11y")}
            >
              <Ionicons
                name="close"
                size={18}
                color={StitchColors.onSurfaceVariant}
              />
              <Text style={revisionScreenStyles.flashEndSessionText}>
                {t("revision.hub.endSession")}
              </Text>
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
            flipDirection={lastFlipDirection}
            height={flipHeight}
            front={frontFace}
            back={backFace}
          />
        </Animated.View>
      </View>

      {difficultSessionAnswerError ? (
        <Text style={revisionScreenStyles.difficultAnswerError}>
          {difficultSessionAnswerError}
        </Text>
      ) : null}

      <View
        style={[
          revisionScreenStyles.flashNavRow,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          style={({ pressed }) => [
            homeWordCardStyles.roundIconButton,
            revisionScreenStyles.flashNavUndoCircle,
            !canUndoFlashcard && revisionScreenStyles.flashNavPrevDisabled,
            roundIconPressStyle(pressed, !canUndoFlashcard),
          ]}
          onPress={handleUndoPress}
          disabled={!canUndoFlashcard}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canUndoFlashcard }}
          accessibilityLabel={t("revision.hub.undo")}
        >
          <Ionicons
            name="arrow-undo"
            size={22}
            color={StitchColors.onSurfaceVariant}
          />
        </Pressable>
        <Pressable
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            revisionScreenStyles.flashNavButton,
            revisionScreenStyles.flashNavDontKnow,
            surfacePressStyle(pressed, false),
          ]}
          onPress={handleDontKnowPress}
          accessibilityRole="button"
          accessibilityLabel={t("revision.hub.answerDontKnow")}
        >
          <Text style={revisionScreenStyles.flashNavDontKnowText}>
            {t("revision.hub.answerDontKnow")}
          </Text>
        </Pressable>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            revisionScreenStyles.flashNavButton,
            revisionScreenStyles.flashNavKnow,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={handleKnowPress}
          accessibilityRole="button"
          accessibilityLabel={t("revision.hub.answerKnow")}
        >
          <Text style={revisionScreenStyles.flashNavKnowText}>
            {t("revision.hub.answerKnow")}
          </Text>
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
