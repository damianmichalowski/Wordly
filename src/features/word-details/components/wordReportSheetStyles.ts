import { StyleSheet } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export const wordReportSheetStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: StitchFonts.headline,
    fontWeight: "700",
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: StitchColors.outlineVariant,
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: StitchColors.onSurfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterOn: {
    borderColor: StitchColors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: StitchColors.primary,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurface,
    lineHeight: 20,
  },
  commentInput: {
    minHeight: 96,
    maxHeight: 140,
    borderRadius: StitchRadius.lg,
    borderWidth: 1,
    borderColor: StitchColors.outlineVariant,
    backgroundColor: StitchColors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurface,
    textAlignVertical: "top",
  },
  commentMeta: {
    fontSize: 12,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "right",
    marginTop: 4,
  },
  commentMetaError: {
    color: StitchColors.error,
    fontFamily: StitchFonts.bodyMedium,
  },
  commentInputInvalid: {
    borderColor: StitchColors.error,
  },
  errorText: {
    fontSize: 14,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.error,
    marginTop: 8,
  },
  successBlock: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 12,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  successBody: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.outlineVariant,
    backgroundColor: StitchColors.surface,
  },
  submitBtn: {
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onPrimary,
    fontWeight: "700",
  },
});
