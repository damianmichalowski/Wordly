import { StyleSheet } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export const endSessionConfirmSheetStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  /** Fades in; does not slide with the sheet. */
  scrim: {
    backgroundColor: "rgba(47, 51, 52, 0.4)",
  },
  sheet: {
    width: "100%",
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: StitchColors.surfaceContainerHighest,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.primary,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onPrimary,
  },
  secondaryBtn: {
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainer,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
});
