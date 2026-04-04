import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_PRIMARY,
  HIT_SLOP_MINI,
  primarySolidPressStyle,
  roundIconPressStyle,
} from "@/src/components/ui/interaction";
import { DailyWordScreenSkeleton } from "@/src/features/daily-word/components/DailyWordScreenSkeleton";
import { dailyWordCardStyles as card } from "@/src/features/daily-word/styles/dailyWordCard.styles";
import { groupSensesByPartOfSpeech } from "@/src/features/daily-word/utils/groupSensesByPartOfSpeech";
import {
  canPronounce,
  speakWord,
} from "@/src/services/audio/pronunciationService";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";
import type { VocabularyWord } from "@/src/types/words";

import { useWordDetailsScreenData } from "../hooks/useWordDetailsScreenData";
import { wordDetailsStyles as styles } from "../styles/wordDetailsStyles";
import type { WordDetails } from "../types/wordDetails.types";

function toSpeakPayload(details: WordDetails): VocabularyWord {
  const first = details.senses[0];
  return {
    id: details.word_id,
    sourceLanguageCode: details.target_language.code as any,
    targetLanguageCode: (first?.translation.native_language_id ?? "en") as any,
    sourceText: details.lemma,
    targetText: first?.translation?.text ?? "",
    exampleSource: "",
    exampleTarget: "",
    cefrLevel: (details.cefr.code ?? "A1") as any,
    pronunciationText: details.ipa ?? undefined,
    audioUrl: null,
  };
}

export default function WordDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wordId, panel, refetch } = useWordDetailsScreenData();

  const posGroups = useMemo(() => {
    if (panel.kind !== "content") {
      return [];
    }
    const list = panel.details.senses ?? [];
    if (list.length === 0) {
      return [];
    }
    const ordered = [...list].sort((a, b) => a.sense_order - b.sense_order);
    return groupSensesByPartOfSpeech(ordered);
  }, [panel]);

  const speakPayload = useMemo(
    () => (panel.kind === "content" ? toSpeakPayload(panel.details) : null),
    [panel],
  );
  const canSpeak = canPronounce(speakPayload);

  const onSpeak = useCallback(() => {
    if (!speakPayload) {
      return;
    }
    logUserAction("button_press", {
      target: "word_details_pronounce",
      wordId: speakPayload.id,
    });
    void speakWord(speakPayload);
  }, [speakPayload]);

  const header = useMemo(() => {
    const loaded = panel.kind === "content";
    return (
      <ScreenHeader
        title={loaded ? "" : "Słowo"}
        titleSize="small"
        hideTitle={loaded}
        onBackPress={() => {
          logUserAction("button_press", {
            target: "word_details_back",
            wordId: wordId || "",
          });
          router.back();
        }}
      />
    );
  }, [panel.kind, router, wordId]);

  const centerScroll =
    panel.kind === "error" || panel.kind === "invalid_id";

  const errorMessage =
    panel.kind === "invalid_id" || panel.kind === "error"
      ? panel.message
      : null;

  const ipa =
    panel.kind === "content" ? panel.details.ipa?.trim() : undefined;

  const scrollBody =
    panel.kind === "loading_shell" ? (
      <DailyWordScreenSkeleton />
    ) : panel.kind === "invalid_id" || panel.kind === "error" ? (
      <View style={styles.errorBlock}>
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={StitchColors.outlineVariant}
        />
        <Text style={styles.titleError}>Nie udało się wczytać</Text>
        <Text style={styles.muted}>{errorMessage}</Text>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.retryButton,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={() => {
            logUserAction("button_press", {
              target: "word_details_retry",
              wordId: wordId || "",
            });
            void refetch();
          }}
        >
          <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
        </Pressable>
        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.ghostButton,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={() => {
            logUserAction("button_press", {
              target: "word_details_back_error_state",
              wordId: wordId || "",
            });
            router.back();
          }}
        >
          <Text style={styles.ghostButtonText}>Wróć</Text>
        </Pressable>
      </View>
    ) : (
      <>
        <View style={card.heroBlock}>
          <View style={card.heroTitleRow}>
            <Text style={card.lemma}>{panel.details.lemma}</Text>
            <View style={card.heroMetaInline}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Wymowa"
                android_ripple={ANDROID_RIPPLE_ICON_ROUND}
                hitSlop={HIT_SLOP_MINI}
                style={({ pressed }) => [
                  card.roundIconButton,
                  roundIconPressStyle(pressed, !canSpeak),
                ]}
                onPress={onSpeak}
                disabled={!canSpeak}
              >
                <Ionicons
                  name="volume-medium"
                  size={22}
                  color={
                    canSpeak
                      ? StitchColors.onSurface
                      : StitchColors.outlineVariant
                  }
                />
              </Pressable>
            </View>
          </View>
          <View style={card.heroIpaRow}>
            {ipa ? <Text style={card.ipa}>/{ipa}/</Text> : null}
            <View style={card.pillCefrCompact}>
              <Text style={card.pillCefrCompactText}>
                {panel.details.cefr.code}
              </Text>
            </View>
            {panel.details.categories.map((c) => (
              <View key={c.id} style={card.pillCefrCompact}>
                <Text style={card.pillCefrCompactText}>{c.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {posGroups.map((group) => (
          <View key={group.posId} style={card.tile}>
            {group.senses.map((s, idx) => {
              const examples = [...s.translation.examples].sort(
                (a, b) => a.order - b.order,
              );
              const showFollows = idx > 0;
              return (
                <View
                  key={s.sense_id}
                  style={[card.senseBlock, showFollows && card.senseBlockFollows]}
                >
                  {idx === 0 ? (
                    <Text style={card.sensePos}>{group.posName}</Text>
                  ) : null}
                  <Text style={card.translation}>{s.translation.text}</Text>
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

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        contentContainerStyle={[
          centerScroll ? styles.scrollContentCentered : styles.scrollContent,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
        {scrollBody}
      </ScrollView>
    </View>
  );
}
