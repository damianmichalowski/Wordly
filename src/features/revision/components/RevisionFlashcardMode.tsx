import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";
import { LogTag, logger } from "@/src/utils/logger";

import { revisionScreenStyles } from "../revisionScreenStyles";
import { RevisionFlipCard } from "./RevisionFlipCard";

type RevisionFlashcardModeProps = {
  flashDeck: VocabularyWord[];
  index: number;
  activeCard: VocabularyWord | null;
  isFlipped: boolean;
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

  /** Kierunek animacji talii przy zmianie indeksu (Dalej / Wstecz). */
  const [deckDirection, setDeckDirection] = useState<"next" | "prev">("next");

  const goNextCard = useCallback(() => {
    setDeckDirection("next");
    next();
  }, [next]);

  const goPreviousCard = useCallback(() => {
    setDeckDirection("prev");
    previous();
  }, [previous]);

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
          onPress={onAbortSession}
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
  );

  const frontFace = (
    <View style={revisionScreenStyles.revisionFlipFaceRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Odwróć fiszkę"
        onPress={flip}
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
        onPress={flip}
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
              onPress={onAbortSession}
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
          onPress={
            isLastCard
              ? onLastCardContinue ?? onAbortSession
              : goNextCard
          }
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
