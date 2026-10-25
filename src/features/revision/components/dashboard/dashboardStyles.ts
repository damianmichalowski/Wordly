import { StyleSheet } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export const dashboardStyles = StyleSheet.create({
  section: {
    marginTop: 32,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  // ── Hero card ──────────────────────────────────────────
  heroCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 22,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroValue: {
    fontSize: 28,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    letterSpacing: -0.4,
  },
  heroLabel: {
    fontSize: 14,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
  heroAccuracyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  heroAccuracyValue: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
  heroImprovementPositive: {
    fontSize: 13,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.secondary,
    marginTop: 4,
  },
  heroImprovementNeutral: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    marginTop: 4,
  },

  // ── Stat grid ──────────────────────────────────────────
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: 140,
    borderRadius: StitchRadius.md,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statCellValue: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  statCellLabel: {
    fontSize: 12,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
  },

  // ── Memory card ────────────────────────────────────────
  memoryCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  memoryTitle: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
    letterSpacing: 0.1,
  },
  memoryRow: {
    gap: 6,
  },
  memoryRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memoryRowLabel: {
    fontSize: 13,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
  },
  memoryRowCount: {
    fontSize: 13,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  memoryBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: StitchColors.surfaceContainerHigh,
    overflow: "hidden",
  },
  memoryBarFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 2,
  },
  memoryBarStrong: {
    backgroundColor: StitchColors.secondary,
  },
  memoryBarDueSoon: {
    backgroundColor: StitchColors.primary,
  },
  memoryBarAttention: {
    backgroundColor: StitchColors.error,
  },

  // ── Best session ───────────────────────────────────────
  bestCard: {
    borderRadius: StitchRadius.md,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bestIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${StitchColors.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  bestContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bestLabel: {
    fontSize: 12,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
  },
  bestValue: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },

  // ── Empty / error ──────────────────────────────────────
  emptyCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
  },

  // ── Skeleton ───────────────────────────────────────────
  skeletonCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 22,
    gap: 10,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  skeletonLineWide: {
    width: "75%",
  },
  skeletonLineNarrow: {
    width: "45%",
  },
  skeletonLineShort: {
    width: "30%",
    height: 22,
    borderRadius: StitchRadius.sm,
  },
});
