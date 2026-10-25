import { Image, type ImageStyle, type StyleProp } from "react-native";

const source = require("@/assets/icons/brain-icon.png");

interface BrainIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Lucide "brain" icon rendered as a tinted PNG image.
 *
 * The PNG was generated from the Lucide v0.526.0 SVG source at 1×/2×/3×
 * so it looks identical to the original vector on every pixel density.
 * `tintColor` applies the caller's colour at runtime.
 */
export function BrainIcon({ size = 24, color, style }: BrainIconProps) {
  return (
    <Image
      source={source}
      style={[{ width: size, height: size, tintColor: color }, style]}
      resizeMode="contain"
    />
  );
}
