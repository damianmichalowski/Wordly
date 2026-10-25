import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_SURFACE,
  roundIconPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  DIFFICULT_DONT_KNOW_TARGET,
  MASTERY_STREAK_TARGET,
} from "@/src/components/word/wordDifficultBadge.constants";
import {
  WORD_DIFFICULT_FLASH_ICON_SIZE,
  wordDifficultInteractiveBadgeStyles as s,
} from "@/src/components/word/wordDifficultInteractiveBadge.styles";
import { clampDifficultDisplayStreak } from "@/src/features/revision/difficultWordsSession";
import { useToggleWordDifficult } from "@/src/features/word-progress/hooks/useToggleWordDifficult";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

export type WordDifficultBadgeVariant = "difficult" | "mastery";

type Props = {
  variant: WordDifficultBadgeVariant;
  wordId: string;
  isDifficult?: boolean;
  dontKnowCounter?: number;
  masteryStreak?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

type DifficultDisplay =
  | { kind: "iconOnly" }
  | { kind: "missProgress"; progress: string }
  | { kind: "marked" };

type MasteryDisplay =
  | { kind: "progress"; progress: string }
  | { kind: "complete" };

function buildDifficultDisplay(
  isDifficult: boolean,
  dontKnowCounter: number,
  progressLabel: string,
): DifficultDisplay {
  if (isDifficult || dontKnowCounter >= DIFFICULT_DONT_KNOW_TARGET) {
    return { kind: "marked" };
  }
  if (dontKnowCounter === 1) {
    return { kind: "missProgress", progress: progressLabel };
  }
  return { kind: "iconOnly" };
}

function buildMasteryDisplay(
  t: (key: string, opts?: Record<string, unknown>) => string,
  masteryStreak: number,
): MasteryDisplay {
  const streak = clampDifficultDisplayStreak(masteryStreak);
  if (streak >= MASTERY_STREAK_TARGET) {
    return { kind: "complete" };
  }
  return {
    kind: "progress",
    progress: t("wordProgress.masteryBadge.progress", {
      current: streak,
      total: MASTERY_STREAK_TARGET,
    }),
  };
}

export function WordDifficultInteractiveBadge({
  variant,
  wordId,
  isDifficult = false,
  dontKnowCounter = 0,
  masteryStreak = 0,
  disabled = false,
  style,
}: Props) {
  const { t } = useTranslation();
  const isMastery = variant === "mastery";

  const { isMarked, toggle, isPending } = useToggleWordDifficult({
    wordId,
    initialMarked: isDifficult,
  });

  const difficultDisplay = useMemo(() => {
    const progressLabel = t("wordProgress.difficultBadge.progress", {
      current: 1,
      total: DIFFICULT_DONT_KNOW_TARGET,
    });
    return buildDifficultDisplay(
      isMarked,
      isMarked ? 0 : dontKnowCounter,
      progressLabel,
    );
  }, [dontKnowCounter, isMarked, t]);

  const masteryDisplay = useMemo(
    () => buildMasteryDisplay(t, masteryStreak),
    [masteryStreak, t],
  );

  const difficultLabel = t("wordProgress.difficultBadge.label");
  const masteryLabel = t("wordProgress.masteryBadge.label");
  const masteredLabel = t("wordProgress.masteryBadge.complete");

  if (isMastery) {
    const a11yLabel =
      masteryDisplay.kind === "complete"
        ? t("wordProgress.masteryBadge.a11yComplete")
        : t("wordProgress.masteryBadge.a11yProgress", {
            current: clampDifficultDisplayStreak(masteryStreak),
            total: MASTERY_STREAK_TARGET,
          });

    return (
      <View
        style={[s.pill, style]}
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
      >
        {masteryDisplay.kind === "complete" ? (
          <>
            <Ionicons
              name="checkmark"
              size={WORD_DIFFICULT_FLASH_ICON_SIZE}
              color={StitchColors.primary}
            />
            <Text style={[s.label, s.labelActive]} numberOfLines={1}>
              {masteredLabel}
            </Text>
          </>
        ) : (
          <View style={s.masteryRow}>
            <Text style={s.label} numberOfLines={1}>
              {masteryLabel}{" "}
            </Text>
            <Text style={s.progress} numberOfLines={1}>
              {masteryDisplay.progress}
            </Text>
          </View>
        )}
      </View>
    );
  }

  const interactive = !disabled && !isPending;
  const a11yLabel = isMarked
    ? t("wordProgress.a11yUnmarkDifficult")
    : t("wordProgress.a11yMarkDifficult");

  const flagFilled = difficultDisplay.kind === "marked";
  const flagIconName = flagFilled ? "flag" : "flag-outline";
  const flagIconColor = flagFilled
    ? StitchColors.primary
    : StitchColors.onSurfaceVariant;

  const pillStyle = [
    difficultDisplay.kind === "iconOnly"
      ? s.iconOnlyPill
      : difficultDisplay.kind === "missProgress"
        ? [s.pill, s.pillCompact]
        : s.pill,
    (disabled || isPending) && s.pillDisabled,
    style,
  ];

  const content = (
    <>
      {isPending ? (
        <ActivityIndicator size="small" color={StitchColors.primary} />
      ) : (
        <Ionicons
          name={flagIconName}
          size={WORD_DIFFICULT_FLASH_ICON_SIZE}
          color={flagIconColor}
        />
      )}
      {difficultDisplay.kind === "missProgress" ? (
        <Text style={s.progress} numberOfLines={1}>
          {difficultDisplay.progress}
        </Text>
      ) : null}
      {difficultDisplay.kind === "marked" ? (
        <Text style={[s.label, s.labelActive]} numberOfLines={1}>
          {difficultLabel}
        </Text>
      ) : null}
    </>
  );

  if (!interactive) {
    return (
      <View
        style={pillStyle}
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isPending }}
      android_ripple={
        difficultDisplay.kind === "iconOnly"
          ? ANDROID_RIPPLE_ICON_ROUND
          : ANDROID_RIPPLE_SURFACE
      }
      style={({ pressed }) => [
        pillStyle,
        difficultDisplay.kind === "iconOnly"
          ? roundIconPressStyle(pressed, isPending)
          : surfacePressStyle(pressed, isPending),
      ]}
      onPress={toggle}
      disabled={isPending}
    >
      {content}
    </Pressable>
  );
}
