import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_REVISION_SORT_PREFS,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

import { revisionFiltersSheetStyles as s } from "./revisionFiltersSheetStyles";

export type RevisionFiltersApplyPayload = {
  sortPrefs: RevisionSortPrefs;
  selectedLevels: CefrLevel[];
};

type Draft = {
  sortPrefs: RevisionSortPrefs;
  selectedLevels: CefrLevel[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (payload: RevisionFiltersApplyPayload) => void;
  initialSortPrefs: RevisionSortPrefs;
  initialSelectedLevels: CefrLevel[];
  /** Gdy false, ukryj sekcję poziomów (brak słów w bibliotece). */
  showLevelSections: boolean;
};

export function RevisionFiltersSheet({
  visible,
  onClose,
  onApply,
  initialSortPrefs,
  initialSelectedLevels,
  showLevelSections,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(() => ({
    sortPrefs: { ...initialSortPrefs },
    selectedLevels: [...initialSelectedLevels],
  }));

  useEffect(() => {
    if (visible) {
      setDraft({
        sortPrefs: { ...initialSortPrefs },
        selectedLevels: [...initialSelectedLevels],
      });
    }
  }, [visible, initialSortPrefs, initialSelectedLevels]);

  const resetDraft = useCallback(() => {
    setDraft({
      sortPrefs: { ...DEFAULT_REVISION_SORT_PREFS },
      selectedLevels: [],
    });
  }, []);

  const apply = useCallback(() => {
    onApply({
      sortPrefs: draft.sortPrefs,
      selectedLevels: draft.selectedLevels,
    });
  }, [draft, onApply]);

  /** Ponowne kliknięcie tej samej opcji = wyłączenie (`none`). Wybór drugiej = wyłącza pierwszą. */
  const toggleCefrAsc = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      sortPrefs: {
        ...prev.sortPrefs,
        cefrOrder: prev.sortPrefs.cefrOrder === "asc" ? "none" : "asc",
      },
    }));
  }, []);

  const toggleCefrDesc = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      sortPrefs: {
        ...prev.sortPrefs,
        cefrOrder: prev.sortPrefs.cefrOrder === "desc" ? "none" : "desc",
      },
    }));
  }, []);

  const toggleLevel = useCallback((level: CefrLevel) => {
    setDraft((prev) => {
      const has = prev.selectedLevels.includes(level);
      const selectedLevels = has
        ? prev.selectedLevels.filter((l) => l !== level)
        : [...prev.selectedLevels, level].sort(
            (a, b) => cefrLevels.indexOf(a) - cefrLevels.indexOf(b),
          );
      return { ...prev, selectedLevels };
    });
  }, []);

  const [dateSegWidth, setDateSegWidth] = useState(0);
  const dateThumbX = useSharedValue(0);

  const timeOrder = draft.sortPrefs.timeOrder;

  useEffect(() => {
    if (dateSegWidth <= 0) return;
    const target = timeOrder === "newest" ? 0 : dateSegWidth / 2;
    dateThumbX.value = withTiming(target, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [timeOrder, dateSegWidth]);

  const onDateSegmentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setDateSegWidth(w);
      if (w > 0) {
        dateThumbX.value = timeOrder === "newest" ? 0 : w / 2;
      }
    },
    [timeOrder, dateThumbX],
  );

  const dateThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dateThumbX.value }],
  }));

  const setTimeOrder = useCallback((next: "newest" | "oldest") => {
    setDraft((prev) => ({
      ...prev,
      sortPrefs: { ...prev.sortPrefs, timeOrder: next },
    }));
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalRoot}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, s.scrim]}
          onPress={onClose}
          accessibilityLabel="Zamknij"
        />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Pressable onPress={resetDraft} hitSlop={12}>
              <Text style={s.headerBtnText}>Reset</Text>
            </Pressable>
            <Text style={s.headerTitle} numberOfLines={1}>
              Filtry i sortowanie
            </Text>
            <Pressable
              onPress={onClose}
              style={s.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
            >
              <Ionicons
                name="close"
                size={22}
                color={StitchColors.onSurfaceVariant}
              />
            </Pressable>
          </View>

          <ScrollView
            style={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showLevelSections ? (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Poziom (CEFR)</Text>
                <View style={s.chipWrap}>
                  {cefrLevels.map((level) => {
                    const on = draft.selectedLevels.includes(level);
                    return (
                      <Pressable
                        key={level}
                        onPress={() => toggleLevel(level)}
                        style={[s.levelChip, on && s.levelChipOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text
                          style={[s.levelChipText, on && s.levelChipTextOn]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={s.section}>
              <Text style={s.sectionLabel}>Według daty</Text>
              <View style={s.dateSegmentOuter}>
                <View style={s.dateSegmentTrack}>
                  <View
                    style={s.dateSegmentInner}
                    onLayout={onDateSegmentLayout}
                  >
                    <Animated.View
                      style={[
                        s.dateSegmentThumb,
                        dateSegWidth > 0 && { width: dateSegWidth / 2 },
                        dateThumbStyle,
                      ]}
                    />
                    <View style={s.dateSegmentLabelsRow}>
                      <Pressable
                        style={s.dateSegmentHalf}
                        onPress={() => setTimeOrder("newest")}
                        accessibilityRole="button"
                        accessibilityState={{ selected: timeOrder === "newest" }}
                      >
                        <Text
                          style={[
                            s.dateSegmentLabel,
                            timeOrder === "newest" && s.dateSegmentLabelOn,
                          ]}
                        >
                          Najnowsze
                        </Text>
                      </Pressable>
                      <Pressable
                        style={s.dateSegmentHalf}
                        onPress={() => setTimeOrder("oldest")}
                        accessibilityRole="button"
                        accessibilityState={{ selected: timeOrder === "oldest" }}
                      >
                        <Text
                          style={[
                            s.dateSegmentLabel,
                            timeOrder === "oldest" && s.dateSegmentLabelOn,
                          ]}
                        >
                          Najstarsze
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={[s.section, { marginBottom: 8 }]}>
              <Text style={s.sectionLabel}>Sortowanie poziomów</Text>
              <View style={s.sortLevelGrid}>
                <Pressable
                  onPress={toggleCefrAsc}
                  style={[
                    s.sortLevelCell,
                    draft.sortPrefs.cefrOrder === "asc" && s.sortLevelCellOn,
                  ]}
                >
                  <Text
                    style={[
                      s.sortLevelCellText,
                      draft.sortPrefs.cefrOrder === "asc" &&
                        s.sortLevelCellTextOn,
                    ]}
                    numberOfLines={2}
                  >
                    A1 → C2
                  </Text>
                  <Ionicons
                    name="trending-up"
                    size={20}
                    color={
                      draft.sortPrefs.cefrOrder === "asc"
                        ? StitchColors.primary
                        : StitchColors.outlineVariant
                    }
                  />
                </Pressable>
                <Pressable
                  onPress={toggleCefrDesc}
                  style={[
                    s.sortLevelCell,
                    draft.sortPrefs.cefrOrder === "desc" && s.sortLevelCellOn,
                  ]}
                >
                  <Text
                    style={[
                      s.sortLevelCellText,
                      draft.sortPrefs.cefrOrder === "desc" &&
                        s.sortLevelCellTextOn,
                    ]}
                    numberOfLines={2}
                  >
                    C2 → A1
                  </Text>
                  <Ionicons
                    name="trending-down"
                    size={20}
                    color={
                      draft.sortPrefs.cefrOrder === "desc"
                        ? StitchColors.primary
                        : StitchColors.outlineVariant
                    }
                  />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable style={s.applyBtn} onPress={apply}>
              <Text style={s.applyBtnText}>Zastosuj filtry</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
