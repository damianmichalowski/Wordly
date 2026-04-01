import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

type CenteredUnlockCtaCardProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
};

export function CenteredUnlockCtaCard({
  icon = "sparkles-outline",
  title,
  body,
  primaryLabel,
  onPrimaryPress,
}: CenteredUnlockCtaCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Ionicons name={icon} size={44} color={StitchColors.onSurfaceVariant} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <Pressable
          android_ripple={ANDROID_RIPPLE_PRIMARY}
          style={({ pressed }) => [
            styles.primaryButton,
            primarySolidPressStyle(pressed, false),
          ]}
          onPress={onPrimaryPress}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: StitchColors.surfaceContainerHigh,
    borderRadius: StitchRadius.lg,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: `${StitchColors.outlineVariant}33`,
    width: "100%",
  },
  title: {
    fontSize: 18,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
    width: "100%",
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: StitchColors.primary,
    borderRadius: StitchRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
});

