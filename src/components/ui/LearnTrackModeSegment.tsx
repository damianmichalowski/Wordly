import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

const INSET = 4;

type LearnTrackModeSegmentProps = {
  value: "difficulty" | "category";
  onChange: (next: "difficulty" | "category") => void;
  disabled?: boolean;
};

/**
 * Dwusegmentowy przełącznik (Poziom / Kategoria) z animowanym tłem:
 * czytelniejszy niż suwak i pokazuje „przejście” między trybami.
 */
export function LearnTrackModeSegment({
  value,
  onChange,
  disabled,
}: LearnTrackModeSegmentProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const didInit = useRef(false);

  const pillW = trackWidth > 0 ? (trackWidth - INSET * 2) / 2 : 0;

  useEffect(() => {
    if (pillW <= 0) {
      return;
    }
    const target = value === "category" ? pillW : 0;
    if (!didInit.current) {
      translateX.setValue(target);
      didInit.current = true;
      return;
    }
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [value, pillW, translateX]);

  return (
    <View
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {pillW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: pillW,
              left: INSET,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === "difficulty" }}
          disabled={disabled}
          onPress={() => {
            logUserAction("segment_change", {
              target: "learning_track_mode",
              mode: "difficulty",
            });
            onChange("difficulty");
          }}
          style={({ pressed }) => [
            styles.hit,
            pressed && !disabled && styles.hitPressed,
          ]}
        >
          <Text
            style={[
              styles.label,
              value === "difficulty" ? styles.labelActive : styles.labelIdle,
            ]}
          >
            Poziom
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === "category" }}
          disabled={disabled}
          onPress={() => {
            logUserAction("segment_change", {
              target: "learning_track_mode",
              mode: "category",
            });
            onChange("category");
          }}
          style={({ pressed }) => [
            styles.hit,
            pressed && !disabled && styles.hitPressed,
          ]}
        >
          <Text
            style={[
              styles.label,
              value === "category" ? styles.labelActive : styles.labelIdle,
            ]}
          >
            Kategoria
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Obramowanie jak niezaznaczony `TrackModeTile` */
  track: {
    borderRadius: StitchRadius.xl,
    backgroundColor: StitchColors.surface,
    padding: INSET,
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(175, 179, 179, 0.35)",
  },
  trackDisabled: {
    opacity: 0.55,
  },
  pill: {
    position: "absolute",
    top: INSET,
    bottom: INSET,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.surfaceContainerLowest,
    shadowColor: StitchColors.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    zIndex: 1,
  },
  hit: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hitPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    letterSpacing: -0.2,
  },
  labelActive: {
    color: StitchColors.primary,
  },
  labelIdle: {
    color: StitchColors.onSurfaceVariant,
  },
});
