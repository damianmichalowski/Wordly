import { Image, StyleSheet, Text, View } from "react-native";

import {
  getLocalFlagSource,
  languageToFlagCountryCode,
} from "@/src/features/settings/languageFlags";
import { StitchColors, StitchFonts } from "@/src/theme/wordlyStitchTheme";

type LanguageFlagBadgeProps = {
  code: string;
};

const FLAG_W = 36;
const FLAG_H = 24;
/** Lekkie zaokrąglenie, prostokąt, nie „kapsuła”. */
const FLAG_RADIUS = 4;

/**
 * Flaga jako lokalny PNG (`assets/flags`), bez sieci; unika problemów RN z emoji.
 * Brak pliku / brak mapowania: dwuliterowy kod języka w ramce.
 */
export function LanguageFlagBadge({ code }: LanguageFlagBadgeProps) {
  const label = code.trim().toUpperCase().slice(0, 2) || "…";
  const country = languageToFlagCountryCode(code);
  const source = country ? getLocalFlagSource(country) : null;

  if (!source) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>{label}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.clip}
      accessibilityElementsHidden
      importantForAccessibility="no"
      collapsable={false}
    >
      <Image source={source} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    width: FLAG_W,
    height: FLAG_H,
    borderRadius: FLAG_RADIUS,
    overflow: "hidden",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    width: FLAG_W,
    height: FLAG_H,
    borderRadius: FLAG_RADIUS,
    backgroundColor: StitchColors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fallbackText: {
    fontSize: 11,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
});
