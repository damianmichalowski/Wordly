import { StyleSheet } from "react-native";

import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/**
 * Daily Word / szczegóły: hero bez tła; kafelki tylko na grupy POS.
 */
export const dailyWordCardStyles = StyleSheet.create({
  /** Wiersz CEFR + akcje, lemat, IPA, bez kafelka (tylko `surface` ekranu). */
  heroBlock: {
    gap: 6,
  },
  /** Grupa znaczeń (POS): tło + bardzo delikatna krawędź i lekki cień. */
  tile: {
    padding: 14,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(47, 51, 52, 0.07)",
    shadowColor: StitchColors.onSurface,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  /** Lemat + ikony (wymowa, szczegóły), ikony wyśrodkowane w pionie względem lematu. */
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    rowGap: 6,
  },
  /** Ikony przy lemacie, bez zawijania szerokości. */
  heroMetaInline: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
  },
  /** Mały badge (CEFR, kategoria) obok IPA, minimalna zajętość miejsca. */
  pillCefrCompact: {
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  pillCefrCompactText: {
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  /** Kompaktowy wiersz: IPA, tag CEFR, opcjonalnie kategorie (ten sam styl pigułki). */
  heroIpaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  /** Wyraźniejsze niż pigułki/tag, czytelny affordance kliknięcia. */
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(68, 86, 186, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(68, 86, 186, 0.28)",
  },
  lemma: {
    flex: 1,
    minWidth: 0,
    fontSize: 34,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    letterSpacing: -0.5,
  },
  ipa: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  translation: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  senseBlock: {
    gap: 6,
  },
  senseBlockFollows: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: StitchColors.surfaceContainerHigh,
  },
  sensePos: {
    fontSize: 12,
    fontFamily: StitchFonts.label,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  examples: {
    gap: 6,
    marginTop: 2,
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  exampleAccentBar: {
    width: 3,
    flexShrink: 0,
    borderRadius: 2,
    backgroundColor: StitchColors.primary,
  },
  exampleLine: {
    flex: 1,
    paddingLeft: 10,
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
});
