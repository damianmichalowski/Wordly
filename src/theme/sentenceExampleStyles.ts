import { StyleSheet } from "react-native";

import { StitchColors, StitchFonts } from "@/src/theme/wordlyStitchTheme";

/**
 * Wspólny wygląd przykładów (kreska z lewej, typografia) dla **szczegółów słowa**.
 * Ekran główny Daily używa `sentenceExampleHomeStyles` (ten sam pomysł, ciszej).
 */
export const sentenceExampleStyles = StyleSheet.create({
  /** Sekcja z separatorem u góry. */
  sectionBlock: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainer,
    alignItems: "stretch",
  },
  /** Tytuł sekcji przykładów (np. na szczegółach). */
  sectionTitle: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  /** Jedno zdanie: pionowa kreska z lewej (primaryContainer). */
  exampleLine: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: StitchColors.primaryContainer,
  },
  exampleSource: {
    fontSize: 15,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
    lineHeight: 22,
  },
  exampleTarget: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mutedHint: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  onlineEmpty: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    fontStyle: "italic",
  },
});

/**
 * Daily Word: te same elementy co na szczegółach, ale **drugoplanowo**:
 * cieńsza kreska, stonowane kolory, mniejsza typografia.
 */
export const sentenceExampleHomeStyles = StyleSheet.create({
  sectionBlock: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.outlineVariant,
    alignItems: "stretch",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.outlineVariant,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  exampleLine: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: StitchColors.outlineVariant,
  },
  exampleSource: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mutedHint: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.outlineVariant,
    lineHeight: 18,
  },
  onlineEmpty: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.outlineVariant,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
