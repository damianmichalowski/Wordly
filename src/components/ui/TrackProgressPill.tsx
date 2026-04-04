import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import {
    LayoutChangeEvent,
    Platform,
    PlatformColor,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

const FILL_TIMING_MS = 420;
const PILL_FULL_RADIUS = StitchRadius.full;
/** Android / web: Stitch `secondary`. iOS fill: `systemGreen`. */
const FILL_PROGRESS_FALLBACK = "rgba(40, 108, 52, 0.26)";

const BLUR_IOS = {
  tint: "systemThinMaterialLight" as const,
  intensity: 88,
};

const BLUR_ANDROID = {
  tint: "light" as const,
  intensity: 68,
};

/**
 * Gradient „szkła”, na jasnym tle sam blur jest niewidoczny; to warstwa
 * daje czytelny efekt frosted (jasny górny refleks, chłodniejszy dół, półprzezroczystość).
 */
/** Frost, stonowany; mniejsza alfa = słabszy gradient. */
const GLASS_GRADIENT_COLORS = [
  "rgba(255, 255, 255, 0.48)",
  "rgba(248, 250, 255, 0.18)",
  "rgba(255, 255, 255, 0.04)",
] as const;

const GLASS_LOCATIONS = [0, 0.45, 1] as const;

/** Podkład pod szkłem. */
const DEPTH_PLATE = "rgba(28, 40, 54, 0.2)";
/** Przyciemnienie przy dolnej krawędzi. */
const DEPTH_BOTTOM = ["rgba(0, 0, 0, 0)", "rgba(24, 32, 44, 0.16)"] as const;

export type TrackProgressPillProps = {
  trackName: string;
  progressPercent: number | null;
  isPercentPending?: boolean;
  isInitialProfileLoading?: boolean;
};

/**
 * Efekt glass: ciemniejsza płytka pod spodem + blur + gradient (light) + zielony postęp.
 */
export function TrackProgressPill({
  trackName,
  progressPercent,
  isPercentPending = false,
  isInitialProfileLoading = false,
}: TrackProgressPillProps) {
  const pct =
    progressPercent === null ? 0 : Math.min(100, Math.max(0, progressPercent));

  const shellWidth = useSharedValue(0);
  const progress = useSharedValue(pct);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: FILL_TIMING_MS });
    // `progress` is a Reanimated shared value — stable ref; animate only when pct changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [pct]);

  const onShellLayout = (e: LayoutChangeEvent) => {
    shellWidth.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => {
    const w = shellWidth.value;
    const fillW = w > 0 ? (progress.value / 100) * w : 0;
    const full = w > 0 && progress.value >= 99.5;
    return {
      width: fillW,
      borderTopLeftRadius: PILL_FULL_RADIUS,
      borderBottomLeftRadius: PILL_FULL_RADIUS,
      borderTopRightRadius: full ? PILL_FULL_RADIUS : 0,
      borderBottomRightRadius: full ? PILL_FULL_RADIUS : 0,
    };
  });

  const percentDisplay = isPercentPending
    ? "…"
    : progressPercent === null
      ? "–"
      : `${Math.round(pct)}%`;

  const a11yLabel = isInitialProfileLoading
    ? "Postęp toru, ładowanie"
    : isPercentPending
      ? `${trackName}, ładowanie postępu`
      : progressPercent === null
        ? `${trackName}, brak wartości procentowej`
        : `${trackName}, ${Math.round(pct)} procent`;

  const blurProps = Platform.OS === "ios" ? BLUR_IOS : BLUR_ANDROID;

  return (
    <View
      style={styles.outer}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      {/* Obwódka „nad” jasnym tłem, pigułka nie zlewa się z #F9F9F9. */}
      <View style={styles.shell} onLayout={onShellLayout}>
        <View style={styles.depthPlate} pointerEvents="none" />
        <LinearGradient
          pointerEvents="none"
          style={styles.depthVignette}
          colors={[...DEPTH_BOTTOM]}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {Platform.OS !== "web" ? (
          <BlurView {...blurProps} style={styles.layerFill} />
        ) : null}

        <Animated.View
          style={[styles.fillBase, fillStyle]}
          pointerEvents="none"
        />

        <LinearGradient
          pointerEvents="none"
          style={styles.glassGradient}
          colors={GLASS_GRADIENT_COLORS}
          locations={[...GLASS_LOCATIONS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.92, y: 1 }}
        />

        {/* Cienka górna poświata jak krawędź szkła */}
        <LinearGradient
          pointerEvents="none"
          style={styles.glassHighlight}
          colors={["rgba(255, 255, 255, 0.55)", "rgba(255, 255, 255, 0)"]}
          locations={[0, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <View style={styles.inner}>
          {isInitialProfileLoading ? (
            <Text style={styles.pillText} numberOfLines={1}>
              …
            </Text>
          ) : (
            <Text style={styles.pillText} numberOfLines={1}>
              {`${trackName} · ${percentDisplay}`}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: StitchRadius.full,
    padding: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(36, 48, 64, 0.06)",
    ...Platform.select({
      ios: {
        shadowColor: "#1c2840",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
    }),
  },
  shell: {
    overflow: "hidden",
    borderRadius: StitchRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.55)",
  },
  depthPlate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DEPTH_PLATE,
    zIndex: 0,
  },
  depthVignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  layerFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  fillBase: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    ...Platform.select({
      ios: {
        backgroundColor: PlatformColor("systemGreen"),
        opacity: 0.32,
      },
      default: {
        backgroundColor: FILL_PROGRESS_FALLBACK,
      },
    }),
  },
  glassGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  glassHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 12,
    zIndex: 2,
    opacity: 0.55,
  },
  inner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 3,
  },
  pillText: {
    fontFamily: StitchFonts.label,
    fontSize: 12,
    color: StitchColors.onSurface,
    ...(Platform.OS === "ios"
      ? {
          textShadowColor: "rgba(255, 255, 255, 0.55)",
          textShadowOffset: { width: 0, height: 0.5 },
          textShadowRadius: 1.5,
        }
      : {}),
  },
});
