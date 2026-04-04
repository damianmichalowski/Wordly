import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

export type AchievementUnlockModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  onRequestClose: () => void;
};

export function AchievementUnlockModal({
  visible,
  title,
  subtitle,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel = "Close",
  onSecondaryPress,
  onRequestClose,
}: AchievementUnlockModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        logUserAction("button_press", {
          target: "achievement_unlock_modal_system_back",
        });
        onRequestClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            logUserAction("button_press", {
              target: "achievement_unlock_modal_backdrop",
            });
            onRequestClose();
          }}
        />
        <Animated.View entering={FadeIn.duration(220)} style={styles.card}>
          <Animated.View entering={FadeInDown.duration(320).delay(40)}>
            <View style={styles.iconRing}>
              <Ionicons name="trophy" size={40} color={StitchColors.secondary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Animated.View>
          <View style={styles.actions}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                styles.primaryBtn,
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "achievement_unlock_modal_primary",
                  title,
                });
                onPrimaryPress();
              }}
            >
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            </Pressable>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                styles.secondaryBtn,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "achievement_unlock_modal_secondary",
                  title,
                });
                (onSecondaryPress ?? onRequestClose)();
              }}
            >
              <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 25, 0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: StitchRadius.xl,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 28,
    gap: 22,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: `${StitchColors.outlineVariant}44`,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255, 193, 7, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 24,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  primaryBtn: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.primary,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onPrimary,
  },
  secondaryBtn: {
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerHigh,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
});
