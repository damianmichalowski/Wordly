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
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_COMFORT,
  linkPressStyle,
  primarySolidPressStyle,
  roundIconPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  DEFAULT_REVISION_SORT_PREFS,
  type RevisionSortPrefs,
} from "@/src/services/revision/revisionSortPrefs";
import {
  LIBRARY_TIER_LABEL,
  libraryLevelTiers,
  type LibraryLevelTier,
} from "@/src/types/cefr";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

import { revisionFiltersSheetStyles as s } from "./revisionFiltersSheetStyles";

export type RevisionFiltersApplyPayload = {
  sortPrefs: RevisionSortPrefs;
  selectedTiers: LibraryLevelTier[];
};

type Draft = {
  sortPrefs: RevisionSortPrefs;
  selectedTiers: LibraryLevelTier[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onApply: (payload: RevisionFiltersApplyPayload) => void;
  initialSortPrefs: RevisionSortPrefs;
  initialSelectedTiers: LibraryLevelTier[];
  /** Gdy false, ukryj sekcję poziomów (brak słów w bibliotece). */
  showLevelSections: boolean;
};

export function RevisionFiltersSheet({
  visible,
  onClose,
  onApply,
  initialSortPrefs,
  initialSelectedTiers,
  showLevelSections,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(() => ({
    sortPrefs: { ...initialSortPrefs },
    selectedTiers: [...initialSelectedTiers],
  }));

  useEffect(() => {
    if (visible) {
      setDraft({
        sortPrefs: { ...initialSortPrefs },
        selectedTiers: [...initialSelectedTiers],
      });
    }
  }, [visible, initialSortPrefs, initialSelectedTiers]);

  const resetDraft = useCallback(() => {
    logUserAction("button_press", { target: "filters_sheet_reset" });
    setDraft({
      sortPrefs: { ...DEFAULT_REVISION_SORT_PREFS },
      selectedTiers: [],
    });
  }, []);

  const apply = useCallback(() => {
    logUserAction("filters_apply", {
      target: "library",
      sortOrder: draft.sortPrefs.timeOrder,
      tierCount: draft.selectedTiers.length,
    });
    onApply({
      sortPrefs: draft.sortPrefs,
      selectedTiers: draft.selectedTiers,
    });
  }, [draft, onApply]);

  const toggleTier = useCallback((tier: LibraryLevelTier) => {
    logUserAction("filters_change", {
      target: "library_filter_tier_toggle",
      tier,
    });
    setDraft((prev) => {
      const has = prev.selectedTiers.includes(tier);
      const selectedTiers = has
        ? prev.selectedTiers.filter((t) => t !== tier)
        : [...prev.selectedTiers, tier].sort(
            (a, b) =>
              libraryLevelTiers.indexOf(a) - libraryLevelTiers.indexOf(b),
          );
      return { ...prev, selectedTiers };
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
    logUserAction("filters_change", {
      target: "library_sort_time_order",
      order: next,
    });
    setDraft((prev) => ({
      ...prev,
      sortPrefs: { ...prev.sortPrefs, timeOrder: next },
    }));
  }, []);

  const dismissSheet = useCallback(
    (reason: "backdrop" | "close" | "system") => {
      logUserAction("button_press", {
        target: "filters_sheet_dismiss",
        reason,
      });
      onClose();
    },
    [onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => dismissSheet("system")}
    >
      <View style={s.modalRoot}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, s.scrim]}
          onPress={() => dismissSheet("backdrop")}
          accessibilityLabel="Zamknij"
        />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Pressable
              onPress={resetDraft}
              hitSlop={HIT_SLOP_COMFORT}
              style={({ pressed }) => linkPressStyle(pressed, false)}
            >
              <Text style={s.headerBtnText}>Reset</Text>
            </Pressable>
            <Text style={s.headerTitle} numberOfLines={1}>
              Filtry i sortowanie
            </Text>
            <Pressable
              onPress={() => dismissSheet("close")}
              android_ripple={ANDROID_RIPPLE_ICON_ROUND}
              style={({ pressed }) => [s.closeBtn, roundIconPressStyle(pressed, false)]}
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
                <Text style={s.sectionLabel}>Poziom</Text>
                <View style={s.chipWrap}>
                  {libraryLevelTiers.map((tier) => {
                    const on = draft.selectedTiers.includes(tier);
                    return (
                      <Pressable
                        key={tier}
                        onPress={() => toggleTier(tier)}
                        android_ripple={ANDROID_RIPPLE_SURFACE}
                        style={({ pressed }) => [
                          s.levelChip,
                          on && s.levelChipOn,
                          surfacePressStyle(pressed, false),
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text
                          style={[s.levelChipText, on && s.levelChipTextOn]}
                        >
                          {LIBRARY_TIER_LABEL[tier]}
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
                        android_ripple={ANDROID_RIPPLE_SURFACE}
                        style={({ pressed }) => [
                          s.dateSegmentHalf,
                          surfacePressStyle(pressed, false),
                        ]}
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
                        android_ripple={ANDROID_RIPPLE_SURFACE}
                        style={({ pressed }) => [
                          s.dateSegmentHalf,
                          surfacePressStyle(pressed, false),
                        ]}
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
          </ScrollView>

          <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                s.applyBtn,
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={apply}
            >
              <Text style={s.applyBtnText}>Zastosuj filtry</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
