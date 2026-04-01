import { useMemo } from "react";
import {
  DynamicColorIOS,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

const widgetIosLabel =
  Platform.OS === "ios"
    ? DynamicColorIOS({ light: "#000000", dark: "#FFFFFF" })
    : StitchColors.onSurface;
const widgetIosSecondaryLabel =
  Platform.OS === "ios"
    ? DynamicColorIOS({
        light: "rgba(60, 60, 67, 0.6)",
        dark: "rgba(235, 235, 245, 0.6)",
      })
    : StitchColors.onSurfaceVariant;
const widgetIosBackground =
  Platform.OS === "ios"
    ? DynamicColorIOS({ light: "#FFFFFF", dark: "#1C1C1E" })
    : StitchColors.surfaceContainerLowest;

/** Jak `systemSmall` (~155 pt), spójnie z `WordlyDailyWidget.swift` i Settings. */
export const WIDGET_SMALL_REFERENCE_PT = 155;

export type WidgetHomePreviewCardProps = {
  word: string;
  /** Do 3 linii tłumaczeń (sensy), jak na natywnym widżecie. */
  translations: string[];
  /** Bok kwadratu podglądu (dp). */
  size: number;
};

export function WidgetHomePreviewCard({
  word,
  translations,
  size,
}: WidgetHomePreviewCardProps) {
  const scale = size / WIDGET_SMALL_REFERENCE_PT;
  const metrics = useMemo(() => {
    const s = scale;
    return {
      pad: 16 * s,
      brandFont: Math.max(9, 11 * s),
      brandLineHeight: 14 * s,
      brandLetterSpacing: 0.35 * s,
      brandToHero: 8 * s,
      heroFont: Math.max(14, 26 * s),
      heroLineHeight: 30 * s,
      heroToTrans: 12 * s,
      transFont: Math.max(10, 13 * s),
      transLineHeight: 18 * s,
      decorTop: {
        top: -20 * s,
        right: -16 * s,
        width: 140 * s,
        height: 140 * s,
        borderRadius: 70 * s,
      },
      decorBottom: {
        bottom: -32 * s,
        left: -24 * s,
        width: 160 * s,
        height: 160 * s,
        borderRadius: 80 * s,
      },
    };
  }, [scale]);

  return (
    <View style={[styles.device, { width: size, height: size }]}>
      <View style={styles.decorLayer} pointerEvents="none">
        <View style={[styles.decorBlobTop, metrics.decorTop]} />
        <View style={[styles.decorBlobBottom, metrics.decorBottom]} />
      </View>
      <View style={[styles.stack, { padding: metrics.pad }]}>
        <Text
          style={[
            styles.brand,
            {
              fontSize: metrics.brandFont,
              lineHeight: metrics.brandLineHeight,
              letterSpacing: metrics.brandLetterSpacing,
              marginBottom: metrics.brandToHero,
            },
          ]}
        >
          Wordly
        </Text>
        <Text
          style={[
            styles.word,
            {
              fontSize: metrics.heroFont,
              lineHeight: metrics.heroLineHeight,
            },
          ]}
          numberOfLines={3}
          {...Platform.select({
            ios: {
              adjustsFontSizeToFit: true,
              minimumFontScale: 0.66,
            },
            default: {},
          })}
        >
          {word}
        </Text>
        <View style={{ marginTop: metrics.heroToTrans, gap: 3 * scale }}>
          {translations.slice(0, 3).map((line, idx) => (
            <Text
              key={`${idx}-${line}`}
              style={[
                styles.translation,
                {
                  fontSize: metrics.transFont,
                  lineHeight: metrics.transLineHeight,
                },
              ]}
              numberOfLines={3}
              {...Platform.select({
                ios: {
                  adjustsFontSizeToFit: true,
                  minimumFontScale: 0.8,
                },
                default: {},
              })}
            >
              {line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  device: {
    alignSelf: "center",
    borderRadius: StitchRadius.xl,
    padding: 0,
    justifyContent: "flex-start",
    alignItems: "stretch",
    overflow: "hidden",
    backgroundColor: widgetIosBackground,
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: StitchRadius.xl,
    overflow: "hidden",
  },
  decorBlobTop: {
    position: "absolute",
    backgroundColor: "rgba(68, 86, 186, 0.10)",
  },
  decorBlobBottom: {
    position: "absolute",
    backgroundColor: "rgba(68, 86, 186, 0.03)",
  },
  stack: {
    width: "100%",
    alignItems: "flex-start",
    zIndex: 1,
  },
  brand: {
    color: StitchColors.primary,
    opacity: 0.9,
    ...Platform.select({
      ios: { fontWeight: "600" as const },
      default: { fontFamily: StitchFonts.bodySemi },
    }),
  },
  word: {
    color: widgetIosLabel,
    ...Platform.select({
      ios: { fontWeight: "700" as const },
      default: { fontFamily: StitchFonts.headline },
    }),
  },
  translation: {
    color: widgetIosSecondaryLabel,
    ...Platform.select({
      ios: { fontWeight: "400" as const },
      default: { fontFamily: StitchFonts.body },
    }),
  },
});
