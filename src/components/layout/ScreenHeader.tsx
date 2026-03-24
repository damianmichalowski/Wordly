import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Element po prawej (np. badge poziomu). */
  rightAccessory?: ReactNode;
  /** Gdy podane: przycisk wstecz po lewej (np. ekran stack). */
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
};

/**
 * Wspólny nagłówek ekranu (zamiast domyślnego headera nawigacji).
 */
export function ScreenHeader({
  title,
  subtitle,
  rightAccessory,
  onBackPress,
  backAccessibilityLabel = "Wróć",
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 10),
        },
      ]}
    >
      <View style={styles.row}>
        {onBackPress ? (
          <Pressable
            onPress={onBackPress}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
          >
            <Ionicons
              name="chevron-back"
              size={26}
              color={StitchColors.onSurface}
            />
          </Pressable>
        ) : null}
        <View style={[styles.titleBlock, onBackPress && styles.titleBlockWithBack]}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightAccessory ? (
          <View style={styles.right}>{rightAccessory}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 14,
    backgroundColor: StitchColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: StitchColors.surfaceContainerHigh,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  backBtn: {
    width: 40,
    height: 40,
    marginLeft: -6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: StitchRadius.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  titleBlockWithBack: {
    paddingLeft: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: StitchFonts.display,
    color: StitchColors.onSurface,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  right: {
    flexShrink: 0,
  },
});
