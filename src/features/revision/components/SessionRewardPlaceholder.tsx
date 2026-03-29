import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export type SessionRewardPlaceholderProps = {
  /**
   * When the revision stats system exists, pass streak/score nodes here.
   * Until then the default calm preview is shown.
   */
  children?: ReactNode;
};

/**
 * Reserved area for future streak, score, and session analytics.
 * Keep layout stable so real data can replace the preview without reflow.
 */
export function SessionRewardPlaceholder({
  children,
}: SessionRewardPlaceholderProps) {
  if (children != null) {
    return <View style={styles.card}>{children}</View>;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.previewLine}>🔥 Streak maintained</Text>
      <Text style={styles.previewHint}>⭐ Score updated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLow,
    gap: 6,
  },
  previewLine: {
    fontSize: 15,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  previewHint: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
  },
});
