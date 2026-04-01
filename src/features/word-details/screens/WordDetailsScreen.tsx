import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import {
    ANDROID_RIPPLE_ICON_ROUND,
    ANDROID_RIPPLE_PRIMARY,
    HIT_SLOP_MINI,
    primarySolidPressStyle,
    roundIconPressStyle,
} from "@/src/components/ui/interaction";
import { dailyWordCardStyles as card } from "@/src/features/daily-word/styles/dailyWordCard.styles";
import { groupSensesByPartOfSpeech } from "@/src/features/daily-word/utils/groupSensesByPartOfSpeech";
import {
    canPronounce,
    speakWord,
} from "@/src/services/audio/pronunciationService";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";

import { getWordDetails } from "../services/wordDetails.service";
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
  const params = useLocalSearchParams<{
    wordId?: string | string[];
    senseId?: string | string[];
  }>();

  const rawWordId = params.wordId ?? params.senseId;
  const wordId =
    typeof rawWordId === "string" ? rawWordId : (rawWordId?.[0] ?? "");

  const [details, setDetails] = useState<WordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wordId) {
      setError("Brak identyfikatora słowa.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getWordDetails(wordId);
      setDetails(data);
    } catch (e) {
      setDetails(null);
      setError(
        e instanceof Error ? e.message : "Nie udało się wczytać szczegółów.",
      );
    } finally {
      setLoading(false);
    }
  }, [wordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const posGroups = useMemo(() => {
    const list = details?.senses ?? [];
    if (list.length === 0) {
      return [];
    }
    const ordered = [...list].sort((a, b) => a.sense_order - b.sense_order);
    return groupSensesByPartOfSpeech(ordered);
  }, [details?.senses]);

  const speakPayload = useMemo(
    () => (details ? toSpeakPayload(details) : null),
    [details],
  );
  const canSpeak = canPronounce(speakPayload);

  const onSpeak = useCallback(() => {
    if (!speakPayload) {
      return;
    }
    void speakWord(speakPayload);
  }, [speakPayload]);

  const header = (
    <ScreenHeader title="Słowo" onBackPress={() => router.back()} />
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentCentered}
          keyboardShouldPersistTaps="handled"
        >
          <ActivityIndicator size="small" color={StitchColors.primary} />
        </ScrollView>
      </View>
    );
  }

  if (error || !details) {
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentCentered}
          keyboardShouldPersistTaps="handled"
        >
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={StitchColors.outlineVariant}
          />
          <Text style={styles.titleError}>Nie udało się wczytać</Text>
          <Text style={styles.muted}>{error ?? "Brak danych."}</Text>
          <Pressable
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => [
              styles.retryButton,
              primarySolidPressStyle(pressed, false),
            ]}
            onPress={() => void load()}
          >
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </Pressable>
          <Pressable
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => [
              styles.ghostButton,
              primarySolidPressStyle(pressed, false),
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.ghostButtonText}>Wróć</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const ipa = details.ipa?.trim();

  return (
    <View style={styles.screen}>
      {header}

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
        <View style={card.heroBlock}>
          <View style={card.heroTitleRow}>
            <Text style={card.lemma}>{details.lemma}</Text>
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
            {group.senses.map((s, idx) => {
              const examples = [...s.translation.examples].sort(
                (a, b) => a.order - b.order,
              );
              const showFollows = idx > 0;
              return (
                <View
                  key={s.sense_id}
                  style={[
                    card.senseBlock,
                    showFollows && card.senseBlockFollows,
                  ]}
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
      </ScrollView>
    </View>
  );
}
