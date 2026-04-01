import { Platform, StyleSheet } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/**
 * Cień karty: duży blur + niska opacity = miękki „halo”, nie ciemna plama/kwadrat.
 * Android: umiarkowane elevation (wyższe robi twardy, „kartonowy” kontur).
 */
const focalInnerElevation =
  Platform.OS === "android"
    ? { elevation: 4 }
    : {
        shadowColor: "#000000",
        shadowOpacity: 0.055,
        shadowRadius: 36,
        shadowOffset: { width: 0, height: 7 },
      };

/**
 * Wspólna „karta słowa” (obramowanie, typografia, wiersz z poziomem i akcjami):
 * Daily Word na Home i powtórka w Revision.
 */
export const homeWordCardStyles = StyleSheet.create({
  /** Ten sam kolor co tło ekranu (unikamy „szarej ramki” wyglądającej jak drugi kwadrat). */
  focalShell: {
    borderRadius: StitchRadius.md,
    padding: 4,
    backgroundColor: StitchColors.surface,
  },
  focalInner: {
    borderRadius: StitchRadius.lg,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 20,
    backgroundColor: StitchColors.surfaceContainerLowest,
    position: "relative",
    ...focalInnerElevation,
  },
  focalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainer,
  },
  levelPillText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  /** Wspólny rozmiar dla przycisków w rogu (np. głośnik). */
  roundIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: StitchColors.surfaceContainer,
  },
  wordTranslationBlock: {
    gap: 14,
  },
  heroWord: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  ipa: {
    marginTop: -2,
    fontSize: 16,
    fontFamily: StitchFonts.body,
    fontStyle: "italic",
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
  },
  translationBlock: {
    gap: 8,
  },
  translation: {
    fontSize: 18,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 26,
  },
  translationSeparator: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.outlineVariant,
  },
  cardLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249,249,249,0.92)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: StitchRadius.lg,
    gap: 10,
    zIndex: 2,
  },
  cardLoadingText: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
