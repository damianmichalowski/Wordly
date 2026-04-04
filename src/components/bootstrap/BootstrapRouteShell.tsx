import { View } from "react-native";

import { useColorScheme } from "@/src/hooks/useColorScheme";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

/** Matches Stack `contentStyle` / tab surfaces — no spinner, avoids null/blank during bootstrap. */
const DARK_SHELL = "#121418";

/**
 * Stable full-screen frame while fonts or app bootstrap resolve.
 * Keeps the same background as the real navigator so there is no flash or “empty” frame.
 */
export function BootstrapRouteShell() {
  const colorScheme = useColorScheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          colorScheme === "dark" ? DARK_SHELL : StitchColors.surface,
      }}
    />
  );
}
