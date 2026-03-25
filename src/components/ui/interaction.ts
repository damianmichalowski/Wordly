import {
  Platform,
  type PressableAndroidRippleConfig,
  type ViewStyle,
} from "react-native";

import { StitchColors } from "@/src/theme/wordlyStitchTheme";

/** Extra tap area beyond visual bounds (Apple ~44pt guideline). */
export const HIT_SLOP_COMFORT = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
} as const;

export const HIT_SLOP_MINI = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
} as const;

/** Ripple on neutral / surface controls (Android). */
export const ANDROID_RIPPLE_SURFACE: PressableAndroidRippleConfig = {
  color: `${StitchColors.onSurface}16`,
  borderless: false,
};

/** Ripple on primary-filled buttons (Android). */
export const ANDROID_RIPPLE_PRIMARY: PressableAndroidRippleConfig = {
  color: "rgba(255,255,255,0.22)",
  borderless: false,
};

/** Ripple on destructive-toned controls (Android). */
export const ANDROID_RIPPLE_MUTED: PressableAndroidRippleConfig = {
  color: `${StitchColors.error}22`,
  borderless: false,
};

/** Bounded circular icon buttons (~44pt). */
export const ANDROID_RIPPLE_ICON_ROUND: PressableAndroidRippleConfig = {
  color: `${StitchColors.onSurface}18`,
  borderless: true,
};

/**
 * Light cards, list rows: iOS pressed dim; Android relies on `android_ripple`.
 */
export function surfacePressStyle(
  pressed: boolean,
  disabled: boolean,
): ViewStyle {
  if (disabled || Platform.OS === "android") {
    return {};
  }
  if (pressed) {
    return { opacity: 0.93 };
  }
  return {};
}

/**
 * Circular icon affordances on tinted backgrounds (Daily card, details).
 */
export function roundIconPressStyle(
  pressed: boolean,
  disabled: boolean,
): ViewStyle {
  if (disabled) {
    return {};
  }
  if (Platform.OS === "android") {
    return {};
  }
  if (pressed) {
    return { opacity: 0.86, transform: [{ scale: 0.94 }] };
  }
  return {};
}

/**
 * Primary solid CTA: subtle shrink so the label stays fully opaque (iOS).
 */
export function primarySolidPressStyle(
  pressed: boolean,
  disabled: boolean,
): ViewStyle {
  if (disabled || Platform.OS === "android") {
    return {};
  }
  if (pressed) {
    return { transform: [{ scale: 0.985 }] };
  }
  return {};
}

/** Text links / low-emphasis controls. */
export function linkPressStyle(pressed: boolean, disabled: boolean): ViewStyle {
  if (disabled || Platform.OS === "android") {
    return {};
  }
  if (pressed) {
    return { opacity: 0.75 };
  }
  return {};
}
