import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "react-native";

import {
  ANDROID_RIPPLE_ICON_ROUND,
  ANDROID_RIPPLE_SURFACE,
  HIT_SLOP_MINI,
  roundIconPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { homeWordCardStyles } from "@/src/features/daily-word/styles/homeWordCardStyles";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

const FLASHCARD_REPORT_ICON_COLOR = "rgba(168, 54, 75, 0.72)";

import { WordReportSheet } from "./WordReportSheet";
import { wordReportEntryStyles as s } from "./wordReportEntryStyles";

type Props = {
  wordId: string;
  lemma: string;
  variant: "inline" | "icon" | "flashcardCorner";
  logOpenTarget: string;
  disabled?: boolean;
};

export function WordReportEntry({
  wordId,
  lemma,
  variant,
  logOpenTarget,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = useCallback(() => {
    if (disabled) {
      return;
    }
    logUserAction("button_press", {
      target: logOpenTarget,
      wordId,
    });
    setSheetOpen(true);
  }, [disabled, logOpenTarget, wordId]);

  return (
    <>
      {variant === "inline" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wordDetails.reportCta")}
          android_ripple={ANDROID_RIPPLE_SURFACE}
          style={({ pressed }) => [
            s.inlineCta,
            surfacePressStyle(pressed, disabled),
          ]}
          onPress={open}
          disabled={disabled}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={StitchColors.primary}
          />
          <Text style={s.inlineCtaText}>{t("wordDetails.reportCta")}</Text>
        </Pressable>
      ) : variant === "flashcardCorner" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wordDetails.reportCta")}
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          hitSlop={HIT_SLOP_MINI}
          style={({ pressed }) => [
            homeWordCardStyles.roundIconButton,
            roundIconPressStyle(pressed, disabled),
          ]}
          onPress={open}
          disabled={disabled}
        >
          <Ionicons
            name="alert-circle-outline"
            size={22}
            color={FLASHCARD_REPORT_ICON_COLOR}
          />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wordDetails.reportCta")}
          android_ripple={ANDROID_RIPPLE_ICON_ROUND}
          hitSlop={HIT_SLOP_MINI}
          style={({ pressed }) => [
            s.iconButton,
            roundIconPressStyle(pressed, disabled),
          ]}
          onPress={open}
          disabled={disabled}
        >
          <Ionicons
            name="alert-circle-outline"
            size={22}
            color={StitchColors.primary}
          />
        </Pressable>
      )}
      <WordReportSheet
        visible={sheetOpen}
        wordId={wordId}
        lemma={lemma}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
