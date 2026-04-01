import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  linkPressStyle,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import { LanguageFlagBadge } from "@/src/features/settings/components/LanguageFlagBadge";
import { OnboardingStepChrome } from "@/src/features/onboarding/components/OnboardingStepChrome";
import { useOnboardingDraft } from "@/src/features/onboarding/OnboardingProvider";
import { getOnboardingOptions } from "@/src/features/profile/services/profile.service";
import type { OnboardingLanguage } from "@/src/features/profile/types/profile.types";
import { StitchColors, StitchFonts, StitchRadius } from "@/src/theme/wordlyStitchTheme";

type PickerSlot = "source" | "target" | null;

const SCROLL_OVERFLOW_EPS_PX = 2;

/** ISO 639-1 z locale urządzenia (Hermes / JSC). */
function getDevicePrimaryLanguageTag(): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    const tag = loc.replace(/_/g, "-").split("-")[0]?.toLowerCase() ?? "";
    return tag || "en";
  } catch {
    return "en";
  }
}

function pickDefaultNativeLanguageId(
  languages: OnboardingLanguage[],
  deviceTag: string,
): string | null {
  if (languages.length === 0) {
    return null;
  }
  const n = deviceTag.toLowerCase().slice(0, 2);
  const match = languages.find(
    (l) => l.code.trim().toLowerCase().slice(0, 2) === n,
  );
  if (match) {
    return match.id;
  }
  const english = languages.find((l) =>
    l.code.trim().toLowerCase().startsWith("en"),
  );
  if (english) {
    return english.id;
  }
  return languages[0].id;
}

function LanguagePickerRow({
  language,
  onPress,
  emptyLabel,
}: {
  language: OnboardingLanguage | null;
  onPress: () => void;
  /** Gdy brak wyboru (np. język nauki). */
  emptyLabel?: string;
}) {
  const hasLanguage = language != null;
  const isAwaitingChoice = !hasLanguage && emptyLabel != null;
  const title = hasLanguage ? language.name : (emptyLabel ?? "…");
  return (
    <Pressable
      onPress={onPress}
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [
        styles.selectorRow,
        pressed && styles.selectorRowPressed,
      ]}
    >
      <View style={styles.selectorFlagCell}>
        {hasLanguage ? (
          <LanguageFlagBadge code={language.code} />
        ) : isAwaitingChoice ? (
          <View style={styles.selectorFlagPlaceholder}>
            <Ionicons
              name="language-outline"
              size={20}
              color={StitchColors.outlineVariant}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.selectorTextCol}>
        <Text
          style={[
            styles.selectorTitle,
            isAwaitingChoice && styles.selectorTitlePlaceholder,
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.selectorSubtitle,
            isAwaitingChoice && styles.selectorSubtitlePlaceholder,
          ]}
        >
          {hasLanguage
            ? language.code.toUpperCase()
            : isAwaitingChoice
              ? "Dotknij, aby wybrać"
              : ""}
        </Text>
      </View>
      <Ionicons
        name="chevron-down"
        size={22}
        color={StitchColors.outlineVariant}
      />
    </Pressable>
  );
}

export default function OnboardingLanguagePairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const { draft, setNativeLanguageId, setLearningLanguageId } =
    useOnboardingDraft();
  const [languages, setLanguages] = useState<OnboardingLanguage[]>([]);
  const [picker, setPicker] = useState<PickerSlot>(null);

  const languagePickerScrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [languagePickerScroll, setLanguagePickerScroll] = useState({
    layoutH: 0,
    contentH: 0,
  });

  const languagePickerNeedsScroll =
    languagePickerScroll.layoutH > 0 &&
    languagePickerScroll.contentH >
      languagePickerScroll.layoutH + SCROLL_OVERFLOW_EPS_PX;

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

  const native = useMemo(
    () => languages.find((l) => l.id === draft.nativeLanguageId) ?? null,
    [draft.nativeLanguageId, languages],
  );
  const learning = useMemo(
    () => languages.find((l) => l.id === draft.learningLanguageId) ?? null,
    [draft.learningLanguageId, languages],
  );

  const canContinue =
    draft.nativeLanguageId != null &&
    draft.learningLanguageId != null &&
    draft.nativeLanguageId !== draft.learningLanguageId;

  const swapLanguages = () => {
    const s = draft.nativeLanguageId;
    if (!s || !draft.learningLanguageId) {
      return;
    }
    setNativeLanguageId(draft.learningLanguageId);
    setLearningLanguageId(s);
  };

  const closePicker = () => setPicker(null);

  const selectLanguageInPicker = (id: string) => {
    if (picker === "source") {
      setNativeLanguageId(id);
    } else if (picker === "target") {
      setLearningLanguageId(id);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opts = await getOnboardingOptions();
      if (cancelled) {
        return;
      }
      setLanguages(opts.languages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Język ojczysty: raz, wg locale urządzenia (język nauki zostaje pusty do wyboru). */
  useEffect(() => {
    if (languages.length === 0 || draft.nativeLanguageId != null) {
      return;
    }
    const tag = getDevicePrimaryLanguageTag();
    const id = pickDefaultNativeLanguageId(languages, tag);
    if (id) {
      setNativeLanguageId(id);
    }
  }, [draft.nativeLanguageId, languages, setNativeLanguageId]);

  const sourceBlock = (
    <View style={styles.langCol}>
      <Text style={styles.fieldLabel}>Język ojczysty</Text>
      <LanguagePickerRow
        language={native}
        onPress={() => setPicker("source")}
      />
    </View>
  );

  const targetBlock = (
    <View style={styles.langCol}>
      <Text style={styles.fieldLabel}>Język nauki</Text>
      <LanguagePickerRow
        language={learning}
        onPress={() => setPicker("target")}
        emptyLabel="Wybierz język"
      />
    </View>
  );

  const swapFab = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zamień języki miejscami"
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [styles.swapFab, pressed && styles.swapFabPressed]}
      onPress={swapLanguages}
    >
      <Ionicons name="swap-horizontal" size={24} color={StitchColors.primary} />
    </Pressable>
  );

  const pickerTitle =
    picker === "source" ? "Język ojczysty" : "Język nauki";

  return (
    <OnboardingStepChrome step={1} totalSteps={3}>
      <View style={styles.root}>
        <View style={styles.blobTop} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <Modal
          visible={picker !== null}
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
                <Text style={styles.modalTitle}>{pickerTitle}</Text>
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
                {languages.map((item) => {
                  const selected =
                    picker === "source"
                      ? draft.nativeLanguageId === item.id
                      : draft.learningLanguageId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      android_ripple={ANDROID_RIPPLE_SURFACE}
                      style={({ pressed }) => [
                        styles.modalLanguageRow,
                        selected && styles.modalLanguageRowSelected,
                        pressed && styles.modalLanguageRowPressed,
                      ]}
                      onPress={() => selectLanguageInPicker(item.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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

        <View style={styles.body}>
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollInner}
          >
            <View style={styles.headBlock}>
              <Text style={styles.title}>
                Twój językowy <Text style={styles.titleAccent}>most.</Text>
              </Text>
              <Text style={styles.lead}>
                Wybierz język ojczysty i język, którego chcesz się uczyć.
              </Text>
            </View>

            {isWide ? (
              <View style={styles.wideRow}>
                <View style={styles.wideCol}>{sourceBlock}</View>
                <View style={styles.swapSlot}>{swapFab}</View>
                <View style={styles.wideCol}>{targetBlock}</View>
              </View>
            ) : (
              <View style={styles.langPairColumn}>
                {sourceBlock}
                <View style={styles.swapSlotNarrow}>{swapFab}</View>
                {targetBlock}
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={() => router.push("/(onboarding)/level")}
            android_ripple={ANDROID_RIPPLE_PRIMARY}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                marginBottom: Math.max(insets.bottom, 16),
              },
              !canContinue && styles.primaryButtonDisabled,
              primarySolidPressStyle(pressed, !canContinue),
            ]}
            disabled={!canContinue}
          >
            <Text style={styles.primaryButtonText}>Dalej</Text>
            <Ionicons name="arrow-forward" size={20} color={StitchColors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </OnboardingStepChrome>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blobTop: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(68, 86, 186, 0.07)",
  },
  blobBottom: {
    position: "absolute",
    bottom: -72,
    left: -72,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(40, 108, 52, 0.06)",
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 12,
    /** Tylko odstęp nagłówek → grupa języków; same dropdowny są w `langPairColumn`. */
    gap: 22,
  },
  langPairColumn: {
    width: "100%",
    gap: 12,
  },
  headBlock: {
    gap: 12,
    marginBottom: 4,
    paddingRight: 4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    letterSpacing: -0.6,
  },
  titleAccent: {
    fontStyle: "italic",
    color: StitchColors.secondary,
  },
  lead: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    maxWidth: 520,
  },
  wideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wideCol: {
    flex: 1,
    minWidth: 0,
  },
  langCol: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: StitchFonts.label,
    fontWeight: "600",
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginBottom: 2,
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 72,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectorRowPressed: {
    backgroundColor: StitchColors.surface,
  },
  selectorFlagCell: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectorFlagPlaceholder: {
    width: 36,
    height: 24,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${StitchColors.outlineVariant}80`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: StitchColors.surfaceContainerLowest,
  },
  selectorTextCol: {
    flex: 1,
    minWidth: 0,
  },
  selectorTitle: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 2,
  },
  selectorTitlePlaceholder: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.outlineVariant,
    fontStyle: "italic",
    letterSpacing: 0.15,
  },
  selectorSubtitle: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  selectorSubtitlePlaceholder: {
    fontSize: 11,
    color: StitchColors.outlineVariant,
    letterSpacing: 0.2,
  },
  swapSlot: {
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 2,
    minWidth: 56,
  },
  swapSlotNarrow: {
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: 4,
    width: "100%",
  },
  swapFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: StitchColors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  swapFabPressed: {
    backgroundColor: StitchColors.surface,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: StitchColors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.headline,
    fontSize: 18,
    fontWeight: "700",
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
});
