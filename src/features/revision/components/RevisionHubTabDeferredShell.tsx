import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { revisionScreenStyles as styles } from "@/src/features/revision/revisionScreenStyles";
import { StitchColors, StitchRadius } from "@/src/theme/wordlyStitchTheme";

/**
 * Stable shell while profile settings are unresolved — avoids painting the full hub
 * (unlock / lock copy) before we know onboarding vs authenticated profile.
 */
export function RevisionHubTabDeferredShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.listScreen}>
      <ScreenHeader title="Revision Hub" />
      <ScrollView
        style={styles.hubScroll}
        contentContainerStyle={[
          styles.hubScrollContent,
          { paddingBottom: Math.max(32, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={localStyles.bento}>
          <View style={localStyles.skelHero} />
          <View style={localStyles.skelTile} />
          <View style={localStyles.skelTile} />
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  bento: {
    gap: 12,
    marginTop: 4,
  },
  skelHero: {
    borderRadius: StitchRadius.lg,
    minHeight: 220,
    backgroundColor: StitchColors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${StitchColors.outlineVariant}33`,
  },
  skelTile: {
    borderRadius: StitchRadius.lg,
    minHeight: 148,
    backgroundColor: StitchColors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${StitchColors.outlineVariant}33`,
  },
});
