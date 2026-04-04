import { StyleSheet, View } from "react-native";

import {
  StitchColors,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

/**
 * Placeholdery w układzie Ustawień — ten sam scroll co docelowy ekran, bez zastępowania całości spinnerem.
 */
export function SettingsScreenSkeleton() {
  return (
    <View style={styles.root} accessibilityElementsHidden>
      <View style={styles.profileCard}>
        <View style={styles.avatar} />
        <View style={styles.profileTextCol}>
          <View style={[styles.line, styles.name]} />
          <View style={[styles.line, styles.sub]} />
          <View style={styles.chipsRow}>
            <View style={styles.chip} />
            <View style={styles.chip} />
          </View>
        </View>
      </View>
      <View style={[styles.line, styles.sectionTitle]} />
      <View style={styles.group}>
        <View style={styles.row} />
        <View style={styles.row} />
        <View style={styles.row} />
      </View>
      <View style={[styles.line, styles.sectionTitle]} />
      <View style={styles.group}>
        <View style={styles.row} />
        <View style={styles.row} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingTop: 4,
  },
  profileCard: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  profileTextCol: {
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  line: {
    borderRadius: StitchRadius.sm,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  name: {
    height: 20,
    width: "55%",
  },
  sub: {
    height: 15,
    width: "40%",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  chip: {
    height: 40,
    flex: 1,
    borderRadius: StitchRadius.md,
    backgroundColor: StitchColors.surfaceContainerHigh,
  },
  sectionTitle: {
    height: 16,
    width: "42%",
    marginTop: 8,
  },
  group: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(47, 51, 52, 0.07)",
    overflow: "hidden",
  },
  row: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: StitchColors.surfaceContainer,
  },
});
