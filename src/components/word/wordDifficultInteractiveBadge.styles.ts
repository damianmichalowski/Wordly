import { StyleSheet } from "react-native";

import { StitchColors, StitchFonts } from "@/src/theme/wordlyStitchTheme";

/** Matches `homeWordCardStyles.roundIconButton` (speaker / report on flashcards). */
export const WORD_DIFFICULT_FLASH_ACTION_SIZE = 44;
const FLASH_ACTION_RADIUS = WORD_DIFFICULT_FLASH_ACTION_SIZE / 2;

/** Slightly below speaker (22px) so the pill stays secondary to the lemma. */
export const WORD_DIFFICULT_FLASH_ICON_SIZE = 20;

const FLASH_TEXT_SIZE = 15;
const FLASH_TEXT_LINE = 20;

const flashTextBase = {
  fontSize: FLASH_TEXT_SIZE,
  lineHeight: FLASH_TEXT_LINE,
  fontFamily: StitchFonts.bodySemi,
  letterSpacing: 0.15,
} as const;

export const wordDifficultInteractiveBadgeStyles = StyleSheet.create({
  masteryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    minHeight: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    maxHeight: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: FLASH_ACTION_RADIUS,
    backgroundColor: StitchColors.surfaceContainer,
    maxWidth: "100%",
    flexShrink: 1,
  },
  iconOnlyPill: {
    width: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    height: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    minHeight: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    maxHeight: WORD_DIFFICULT_FLASH_ACTION_SIZE,
    borderRadius: FLASH_ACTION_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: StitchColors.surfaceContainer,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  /** Icon + "1/2" only, aligned with icon-only pill height. */
  pillCompact: {
    paddingHorizontal: 10,
    gap: 3,
  },
  pillDisabled: {
    opacity: 0.55,
  },
  label: {
    ...flashTextBase,
    color: StitchColors.onSurfaceVariant,
    flexShrink: 1,
  },
  labelActive: {
    color: StitchColors.primary,
  },
  separator: {
    ...flashTextBase,
    color: StitchColors.onSurfaceVariant,
  },
  progress: {
    ...flashTextBase,
    color: StitchColors.primary,
    flexShrink: 0,
  },
});
