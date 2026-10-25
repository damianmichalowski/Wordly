import { StyleSheet } from "react-native";

import { StitchColors, StitchFonts } from "@/src/theme/wordlyStitchTheme";

export const wordReportEntryStyles = StyleSheet.create({
  inlineCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  inlineCtaText: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: StitchColors.surfaceContainerLow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: StitchColors.outlineVariant,
  },
});
