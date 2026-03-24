import { StyleSheet } from "react-native";

import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export const wordDetailsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: StitchColors.surface,
  },
  lemmaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  lemmaInRow: {
    flex: 1,
    fontSize: 34,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    letterSpacing: -0.5,
  },
  /** Ten sam rozmiar co na Home (Daily). */
  roundIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: StitchColors.surfaceContainer,
    flexShrink: 0,
  },
  ipa: {
    marginTop: 6,
    fontSize: 17,
    fontFamily: StitchFonts.body,
    fontStyle: "italic",
    color: StitchColors.onSurfaceVariant,
  },
  sectionPos: {
    marginTop: 28,
  },
  posHeading: {
    fontSize: 12,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  senseCard: {
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderRadius: StitchRadius.md,
    padding: 16,
    marginBottom: 12,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** Odstęp bloku przykładów online pod kartami tłumaczeń. */
  examplesAfterTranslations: {
    marginTop: 24,
  },
  examplesAfterTranslationsText: {
    marginTop: 20,
  },
  senseHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  gloss: {
    flex: 1,
    minWidth: "60%",
    fontSize: 17,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
    lineHeight: 24,
  },
  cefrPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  cefrPillText: {
    fontSize: 10,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  removeSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainer,
  },
  removeButton: {
    borderRadius: StitchRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  removeButtonText: {
    fontFamily: StitchFonts.bodySemi,
    fontSize: 15,
    color: StitchColors.error,
  },
  muted: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
  },
  titleError: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    marginBottom: 8,
  },
  backButton: {
    marginTop: 20,
    borderRadius: StitchRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: StitchColors.primary,
  },
  backButtonText: {
    fontFamily: StitchFonts.bodySemi,
    fontSize: 15,
    color: StitchColors.onPrimary,
  },
});
