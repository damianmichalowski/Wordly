import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ANDROID_RIPPLE_PRIMARY,
  ANDROID_RIPPLE_SURFACE,
  primarySolidPressStyle,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { endSessionConfirmSheetStyles as s } from "@/src/features/revision/components/endSessionConfirmSheetStyles";
import { logUserAction } from "@/src/utils/userActionLog";

const SHEET_SLIDE_PX = 420;
const OPEN_MS = 380;
const CLOSE_MS = 300;
const OPEN_EASING = Easing.out(Easing.cubic);
const CLOSE_EASING = Easing.in(Easing.cubic);

type Props = {
  visible: boolean;
  onContinue: () => void;
  onConfirmEnd: () => void;
};

export function EndSessionConfirmSheet({
  visible,
  onContinue,
  onConfirmEnd,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [modalShown, setModalShown] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalShown(true);
      progress.value = withTiming(1, {
        duration: OPEN_MS,
        easing: OPEN_EASING,
      });
      return;
    }

    if (!modalShown) {
      return;
    }

    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: CLOSE_EASING },
      (finished) => {
        if (finished) {
          runOnJS(setModalShown)(false);
        }
      },
    );
  }, [visible, modalShown, progress]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * SHEET_SLIDE_PX },
    ],
  }));

  return (
    <Modal
      visible={modalShown}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={s.modalRoot}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, s.scrim, scrimStyle]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={onContinue}
            accessibilityLabel={t("revision.hub.endSessionConfirm.continue")}
          />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            sheetStyle,
            { paddingBottom: Math.max(20, insets.bottom + 12) },
          ]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <View style={s.handle} />
          <Text style={s.title}>
            {t("revision.hub.endSessionConfirm.title")}
          </Text>
          <Text style={s.body}>{t("revision.hub.endSessionConfirm.body")}</Text>
          <View style={s.actions}>
            <Pressable
              android_ripple={ANDROID_RIPPLE_PRIMARY}
              style={({ pressed }) => [
                s.primaryBtn,
                primarySolidPressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "revision_end_session_confirm_continue",
                });
                onContinue();
              }}
              accessibilityRole="button"
            >
              <Text style={s.primaryBtnText}>
                {t("revision.hub.endSessionConfirm.continue")}
              </Text>
            </Pressable>
            <Pressable
              android_ripple={ANDROID_RIPPLE_SURFACE}
              style={({ pressed }) => [
                s.secondaryBtn,
                surfacePressStyle(pressed, false),
              ]}
              onPress={() => {
                logUserAction("button_press", {
                  target: "revision_end_session_confirm_end",
                });
                onConfirmEnd();
              }}
              accessibilityRole="button"
            >
              <Text style={s.secondaryBtnText}>
                {t("revision.hub.endSessionConfirm.end")}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
