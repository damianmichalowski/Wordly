import { StyleSheet } from "react-native";

import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/** Ekran szczegółów: layout scrolla jak Daily Word; karta z `dailyWordCard.styles`. */
export const wordDetailsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  /** Jak `mainScrollContentCentered` na Home, centrowanie w ScrollView. */
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    minHeight: 320,
    gap: 12,
  },
  muted: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
  },
  titleError: {
    fontSize: 20,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: StitchRadius.xl,
    paddingVertical: 16,
    paddingHorizontal: 28,
    backgroundColor: StitchColors.primary,
    minWidth: 200,
    alignItems: "center",
  },
  retryButtonText: {
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
    color: StitchColors.onPrimary,
  },
  ghostButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  ghostButtonText: {
    fontFamily: StitchFonts.bodySemi,
    fontSize: 15,
    color: StitchColors.primary,
  },
  errorBlock: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
});
