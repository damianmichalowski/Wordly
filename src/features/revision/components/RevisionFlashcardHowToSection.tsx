import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { MASTERY_STREAK_TARGET } from "@/src/components/word/wordDifficultBadge.constants";
import { WORD_DIFFICULT_FLASH_ICON_SIZE } from "@/src/components/word/wordDifficultInteractiveBadge.styles";
import { revisionScreenStyles as styles } from "@/src/features/revision/revisionScreenStyles";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

/** Matches `WordReportEntry` flashcard corner icon color. */
const FLASHCARD_REPORT_ICON_COLOR = "rgba(168, 54, 75, 0.72)";

const FLASHCARD_SPEAKER_ICON_SIZE = 22;
const FLASHCARD_REPORT_ICON_SIZE = 22;

export type RevisionFlashcardHowToVariant = "default" | "difficultWords";

type HowToRowProps = {
  children: ReactNode;
  text: string;
};

function HowToIconSlot({ children }: { children: ReactNode }) {
  return <View style={styles.hubFlashcardHowToIconSlot}>{children}</View>;
}

function HowToRow({ children, text }: HowToRowProps) {
  return (
    <View style={styles.hubFlashcardHowToRow}>
      <HowToIconSlot>{children}</HowToIconSlot>
      <Text style={styles.hubFlashcardHowToRowText}>{text}</Text>
    </View>
  );
}

function HowToInlineMasteryLine({
  label,
  explanation,
  showCheckmark = false,
}: {
  label: string;
  explanation: string;
  showCheckmark?: boolean;
}) {
  return (
    <Text style={styles.hubFlashcardHowToInlineLine}>
      <Text style={styles.hubFlashcardHowToInlineEmphasis}>
        {label}
        {showCheckmark ? " ✓" : ""}
      </Text>
      <Text style={styles.hubFlashcardHowToInlineBody}> {explanation}</Text>
    </Text>
  );
}

type Props = {
  variant?: RevisionFlashcardHowToVariant;
};

export function RevisionFlashcardHowToSection({
  variant = "default",
}: Props) {
  const { t } = useTranslation();
  const isDifficultWords = variant === "difficultWords";

  const masteryProgressSample = t("wordProgress.masteryBadge.progress", {
    current: 0,
    total: MASTERY_STREAK_TARGET,
  });
  const masteryLabel = t("wordProgress.masteryBadge.label");
  const masteredLabel = t("wordProgress.masteryBadge.complete");

  return (
    <View style={styles.hubFlashcardHowTo}>
      <Text style={styles.hubFlashcardHowToTitle}>
        {t("revision.hub.flashcardHowToTitle")}
      </Text>
      <HowToRow text={t("revision.hub.flashcardHowToTap")}>
        <View style={styles.hubFlashcardHowToTapDot} />
      </HowToRow>
      <HowToRow text={t("revision.hub.flashcardHowToSpeaker")}>
        <Ionicons
          name="volume-medium"
          size={FLASHCARD_SPEAKER_ICON_SIZE}
          color={StitchColors.onSurface}
        />
      </HowToRow>
      {!isDifficultWords ? (
        <>
          <HowToRow text={t("revision.hub.flashcardHowToMarkDifficult")}>
            <Ionicons
              name="flag-outline"
              size={WORD_DIFFICULT_FLASH_ICON_SIZE}
              color={StitchColors.onSurfaceVariant}
            />
          </HowToRow>
          <HowToRow text={t("revision.hub.flashcardHowToMarkedDifficult")}>
            <Ionicons
              name="flag"
              size={WORD_DIFFICULT_FLASH_ICON_SIZE}
              color={StitchColors.primary}
            />
          </HowToRow>
          <HowToRow text={t("revision.hub.flashcardHowToProgress")}>
            <View style={styles.hubFlashcardHowToProgressIcons}>
              <Ionicons
                name="flag-outline"
                size={WORD_DIFFICULT_FLASH_ICON_SIZE}
                color={StitchColors.primary}
              />
              <Text style={styles.hubFlashcardHowToProgressBadge}>
                {t("revision.hub.flashcardHowToProgressBadge")}
              </Text>
            </View>
          </HowToRow>
        </>
      ) : null}
      <HowToRow text={t("revision.hub.flashcardHowToReport")}>
        <Ionicons
          name="alert-circle-outline"
          size={FLASHCARD_REPORT_ICON_SIZE}
          color={FLASHCARD_REPORT_ICON_COLOR}
        />
      </HowToRow>
      {isDifficultWords ? (
        <View style={styles.hubFlashcardHowToMasteryBlock}>
          <HowToInlineMasteryLine
            label={`${masteryLabel} ${masteryProgressSample}`}
            explanation={t("revision.hub.flashcardHowToMasteryProgress")}
          />
          <HowToInlineMasteryLine
            label={masteredLabel}
            explanation={t("revision.hub.flashcardHowToMasteryComplete")}
            showCheckmark
          />
        </View>
      ) : null}
    </View>
  );
}

export function RevisionFlashcardHowToReadyCue() {
  const { t } = useTranslation();
  return (
    <Text style={styles.hubFlashcardHowToReady}>
      {t("revision.hub.flashcardHowToReady")}
    </Text>
  );
}
