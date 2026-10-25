import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import {
  ANDROID_RIPPLE_ICON_ROUND,
  HIT_SLOP_MINI,
  roundIconPressStyle,
} from "@/src/components/ui/interaction";
import { homeWordCardStyles } from "@/src/features/daily-word/styles/homeWordCardStyles";
import { useToggleWordDifficult } from "@/src/features/word-progress/hooks/useToggleWordDifficult";
import { useWordDetailsCacheEntry } from "@/src/features/word-progress/hooks/useWordDetailsCacheEntry";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

type Props = {
  wordId: string;
  marked?: boolean;
  disabled?: boolean;
  variant?: "hero" | "flashcard";
};

export function MarkDifficultIconButton({
  wordId,
  marked = false,
  disabled = false,
  variant = "hero",
}: Props) {
  const { t } = useTranslation();
  const cachedDetails = useWordDetailsCacheEntry(wordId);
  const cachedMarked = cachedDetails?.is_difficult;
  const resolvedMarked =
    cachedMarked === true ? true : cachedMarked === false ? false : marked;

  const { isMarked, toggle, isPending } = useToggleWordDifficult({
    wordId,
    initialMarked: resolvedMarked,
  });

  const iconName = isMarked ? "flag" : "flag-outline";
  const iconColor = isMarked
    ? StitchColors.primary
    : StitchColors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isMarked
          ? t("wordProgress.a11yUnmarkDifficult")
          : t("wordProgress.a11yMarkDifficult")
      }
      accessibilityState={{ selected: isMarked, disabled: disabled || isPending }}
      android_ripple={ANDROID_RIPPLE_ICON_ROUND}
      hitSlop={HIT_SLOP_MINI}
      style={({ pressed }) => [
        variant === "hero"
          ? styles.heroButton
          : homeWordCardStyles.roundIconButton,
        roundIconPressStyle(pressed, disabled || isPending),
      ]}
      onPress={toggle}
      disabled={disabled || isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={StitchColors.primary} />
      ) : (
        <Ionicons name={iconName} size={22} color={iconColor} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(68, 86, 186, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(68, 86, 186, 0.28)",
  },
});
