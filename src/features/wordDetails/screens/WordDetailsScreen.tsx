import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import {
  fetchWordDetailBundleForSense,
  type WordDetailBundle,
} from "@/src/services/api/vocabularyApi";
import {
    canPronounce,
    speakWord,
} from "@/src/services/audio/pronunciationService";
import {
    fetchExternalUsageExamples,
    type UsageExampleLine,
} from "@/src/services/examples/externalUsageExamples";
import { removeFromKnown } from "@/src/services/revision/revisionService";
import { getUserProfile } from "@/src/services/storage/profileStorage";
import { sentenceExampleStyles } from "@/src/theme/sentenceExampleStyles";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";

import { partOfSpeechLabel } from "../posLabels";
import { wordDetailsStyles as styles } from "../wordDetailsStyles";

function bundleToSpeakWord(bundle: WordDetailBundle): VocabularyWord {
  return {
    id: bundle.groups[0]?.senses[0]?.senseId ?? "",
    sourceLanguageCode: bundle.sourceLanguageCode,
    targetLanguageCode: bundle.targetLanguageCode,
    sourceText: bundle.lemmaText,
    targetText: bundle.groups[0]?.senses[0]?.glossText ?? "",
    exampleSource: "",
    exampleTarget: "",
    cefrLevel: bundle.groups[0]?.senses[0]?.cefrLevel ?? "A1",
    pronunciationText: bundle.pronunciationText,
    audioUrl: bundle.audioUrl,
  };
}

export default function WordDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    senseId: string | string[];
    from?: string | string[];
  }>();
  const rawId = params.senseId;
  const id = typeof rawId === "string" ? rawId : (rawId?.[0] ?? "");
  const rawFrom = params.from;
  const fromParam = typeof rawFrom === "string" ? rawFrom : rawFrom?.[0];

  const [bundle, setBundle] = useState<WordDetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineExamples, setOnlineExamples] = useState<
    UsageExampleLine[] | null
  >(null);
  const [loadingOnline, setLoadingOnline] = useState(false);

  const fromRevision = fromParam === "revision";

  const load = useCallback(async () => {
    if (!id) {
      setError("Brak identyfikatora słowa.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const profile = await getUserProfile();
    if (!profile || profile.userId === "local-user") {
      setError("Wymagane konto i ukończony onboarding.");
      setLoading(false);
      return;
    }
    const data = await fetchWordDetailBundleForSense(profile, id);
    if (!data) {
      setError("Nie znaleziono słowa w słowniku.");
      setLoading(false);
      return;
    }
    setBundle(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bundle) {
      setOnlineExamples(null);
      setLoadingOnline(false);
      return;
    }
    if (bundle.sourceLanguageCode !== "en") {
      setOnlineExamples(null);
      setLoadingOnline(false);
      return;
    }
    let cancelled = false;
    setLoadingOnline(true);
    setOnlineExamples(null);
    void fetchExternalUsageExamples({
      lemma: bundle.lemmaText,
      sourceLanguageCode: bundle.sourceLanguageCode,
      targetLanguageCode: bundle.targetLanguageCode,
    }).then((rows) => {
      if (!cancelled) {
        setOnlineExamples(rows);
        setLoadingOnline(false);
      }
    });
    return () => {
      cancelled = true;
      setLoadingOnline(false);
    };
  }, [bundle]);

  const onSpeak = useCallback(() => {
    if (!bundle) {
      return;
    }
    const w = bundleToSpeakWord(bundle);
    if (w.id) {
      void speakWord(w);
    }
  }, [bundle]);

  const onRemove = useCallback(() => {
    if (!id || !bundle) {
      return;
    }
    Alert.alert(
      "Usunąć z znanych?",
      `„${bundle.lemmaText}” wróci do kolejki w Daily.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await removeFromKnown(id);
              router.back();
            })();
          },
        },
      ],
    );
  }, [id, bundle, router]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title="Słowo"
          onBackPress={() => router.back()}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={StitchColors.primary} />
        </View>
      </View>
    );
  }

  if (error || !bundle) {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title="Słowo"
          onBackPress={() => router.back()}
        />
        <View style={styles.centered}>
          <Text style={styles.titleError}>Nie udało się wczytać</Text>
          <Text style={styles.muted}>{error ?? "Brak danych."}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Wróć</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const speakPayload = bundleToSpeakWord(bundle);
  const canSpeak = canPronounce(speakPayload);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Słowo"
        onBackPress={() => router.back()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.lemmaRow}>
        <Text style={styles.lemmaInRow} numberOfLines={4}>
          {bundle.lemmaText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Odsłuchaj wymowę"
          style={[styles.roundIconButton, !canSpeak && { opacity: 0.45 }]}
          onPress={onSpeak}
          disabled={!canSpeak}
        >
          <Ionicons
            name="volume-medium"
            size={22}
            color={StitchColors.onSurface}
          />
        </Pressable>
      </View>
      {bundle.pronunciationText ? (
        <Text style={styles.ipa}>/{bundle.pronunciationText}/</Text>
      ) : null}

      {bundle.groups.map((group) => (
        <View key={group.partOfSpeech} style={styles.sectionPos}>
          <Text style={styles.posHeading}>
            {partOfSpeechLabel(group.partOfSpeech)}
          </Text>
          {group.senses.map((sense) => (
            <View key={sense.senseId} style={styles.senseCard}>
              <View style={styles.senseHeader}>
                <Text style={styles.gloss}>{sense.glossText}</Text>
                <View style={styles.cefrPill}>
                  <Text style={styles.cefrPillText}>{sense.cefrLevel}</Text>
                </View>
              </View>
              {sense.examples.length > 0
                ? sense.examples.map((ex, i) => (
                    <View
                      key={`${sense.senseId}-ex-${i}`}
                      style={sentenceExampleStyles.exampleLine}
                    >
                      <Text style={sentenceExampleStyles.exampleSource}>
                        {ex.source}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          ))}
        </View>
      ))}

      {bundle.sourceLanguageCode === "en" && loadingOnline ? (
        <View
          style={[
            sentenceExampleStyles.sectionBlock,
            sentenceExampleStyles.loadingRow,
            styles.examplesAfterTranslations,
          ]}
        >
          <ActivityIndicator size="small" color={StitchColors.primary} />
          <Text style={sentenceExampleStyles.mutedHint}>
            Szukam przykładów zdań…
          </Text>
        </View>
      ) : null}

      {bundle.sourceLanguageCode === "en" &&
      !loadingOnline &&
      onlineExamples &&
      onlineExamples.length > 0 ? (
        <View
          style={[
            sentenceExampleStyles.sectionBlock,
            styles.examplesAfterTranslations,
          ]}
        >
          <Text style={sentenceExampleStyles.sectionTitle}>
            Przykłady użycia
          </Text>
          {onlineExamples.map((ex, i) => (
            <View key={`online-ex-${i}`} style={sentenceExampleStyles.exampleLine}>
              <Text style={sentenceExampleStyles.exampleSource}>{ex.source}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {bundle.sourceLanguageCode === "en" &&
      !loadingOnline &&
      onlineExamples !== null &&
      onlineExamples.length === 0 ? (
        <Text
          style={[
            sentenceExampleStyles.onlineEmpty,
            styles.examplesAfterTranslationsText,
          ]}
        >
          Nie znaleziono krótkich przykładów w sieci dla tego hasła.
        </Text>
      ) : null}

      {fromRevision ? (
        <View style={styles.removeSection}>
          <Pressable style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>Usuń z znanych</Text>
          </Pressable>
        </View>
      ) : null}
      </ScrollView>
    </View>
  );
}
