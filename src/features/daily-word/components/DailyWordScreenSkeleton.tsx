import { StyleSheet, View } from "react-native";

import {
  StitchColors,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/**
 * Layout-aligned placeholders for first Daily Word fetch — avoids a tall centered
 * block + lone spinner (rounded “flash”) before content arrives.
 */
export function DailyWordScreenSkeleton() {
  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.hero}>
        <View style={[styles.line, styles.lemma]} />
        <View style={styles.ipaRow}>
          <View style={[styles.line, styles.ipa]} />
          <View style={styles.pill} />
        </View>
      </View>
      <View style={styles.tile}>
        <View style={[styles.line, styles.pos]} />
        <View style={[styles.line, styles.gloss]} />
        <View style={[styles.line, styles.glossShort]} />
      </View>
      <View style={styles.tile}>
        <View style={[styles.line, styles.pos]} />
        <View style={[styles.line, styles.gloss]} />
      </View>
      <View style={styles.footerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    width: "100%",
    alignSelf: "stretch",
  },
  hero: {
    gap: 10,
    marginBottom: 4,
  },
  ipaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  line: {
    borderRadius: StitchRadius.sm,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  lemma: {
    height: 34,
    width: "72%",
    maxWidth: 280,
  },
  ipa: {
    height: 18,
    width: 120,
  },
  pill: {
    width: 36,
    height: 18,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  tile: {
    padding: 14,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(47, 51, 52, 0.07)",
    gap: 10,
  },
  pos: {
    height: 14,
    width: "40%",
  },
  gloss: {
    height: 16,
    width: "92%",
  },
  glossShort: {
    height: 16,
    width: "64%",
  },
  footerSpacer: {
    height: 88,
  },
});
