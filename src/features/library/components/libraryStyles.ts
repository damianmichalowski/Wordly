import { StyleSheet } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export const libraryStyles = StyleSheet.create({
  // ── Overview card ──────────────────────────────────────
  overviewCard: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 20,
    gap: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  overviewHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  overviewKnown: {
    fontSize: 26,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    letterSpacing: -0.4,
  },
  overviewKnownLabel: {
    fontSize: 14,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
  },
  overviewWeekly: {
    fontSize: 13,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.primary,
  },
  overviewLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  overviewLevelCode: {
    width: 28,
    fontSize: 12,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
  },
  overviewLevelTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: StitchColors.surfaceContainerHigh,
    overflow: "hidden",
  },
  overviewLevelFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: StitchColors.primary,
    minWidth: 2,
  },
  overviewLevelCount: {
    width: 60,
    fontSize: 11,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "right",
  },

  // ── Smart collections ──────────────────────────────────
  collectionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  collectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  collectionChipSelected: {
    backgroundColor: `${StitchColors.primary}14`,
    borderColor: StitchColors.primary,
  },
  collectionChipLabel: {
    fontSize: 13,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
  },
  collectionChipLabelSelected: {
    color: StitchColors.primary,
    fontFamily: StitchFonts.bodySemi,
  },
  collectionChipCount: {
    fontSize: 12,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
  },
  collectionChipCountSelected: {
    color: StitchColors.primary,
  },

  // ── Word row ───────────────────────────────────────────
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderRadius: StitchRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  wordRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  wordRowLemma: {
    fontSize: 16,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  wordRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cefrBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: `${StitchColors.primary}14`,
  },
  cefrBadgeText: {
    fontSize: 10,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
    letterSpacing: 0.4,
  },

  // ── Memory status badge ────────────────────────────────
  memoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memoryBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  memoryBadgeLabel: {
    fontSize: 10,
    fontFamily: StitchFonts.bodyMedium,
    letterSpacing: 0.2,
  },

  // ── Skeleton for overview ──────────────────────────────
  overviewSkeleton: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 20,
    gap: 10,
    marginBottom: 16,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  skeletonShort: { width: "35%", height: 20, borderRadius: 10 },
  skeletonMedium: { width: "60%" },
  skeletonNarrow: { width: "45%" },
});
