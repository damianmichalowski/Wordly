/**
 * Wordly: tokeny z Google Stitch (projekt „Word Details”, motyw „The Mindful Scholar”).
 * Źródło: Stitch `designTheme.namedColors` + typografia Plus Jakarta Sans / Inter.
 *
 * Zasady UI: unikaj twardych obramowań 1px; hierarchia przez `surface` / `surfaceContainer*`.
 * @see docs/STITCH_DESIGN.md
 */
export const StitchColors = {
  primary: "#4456BA",
  onPrimary: "#FAF8FF",
  primaryDim: "#3749AD",
  primaryContainer: "#8596FF",
  onPrimaryContainer: "#001367",
  secondary: "#286C34",
  secondaryContainer: "#ABF4AC",
  onSecondaryContainer: "#185E27",
  surface: "#F9F9F9",
  onSurface: "#2F3334",
  onSurfaceVariant: "#5B6061",
  surfaceContainer: "#ECEEEF",
  surfaceContainerLow: "#F2F4F4",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerHigh: "#E6E9E9",
  surfaceContainerHighest: "#DFE3E4",
  surfaceDim: "#D7DBDB",
  outlineVariant: "#AFB3B3",
  error: "#A8364B",
  errorContainer: "#F97386",
  onError: "#FFF7F7",
} as const;

/** Nazwy rodzin muszą być zgodne z `useFonts` w `app/_layout.tsx`. */
export const StitchFonts = {
  display: "PlusJakartaSans_800ExtraBold",
  headline: "PlusJakartaSans_700Bold",
  title: "PlusJakartaSans_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  label: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const;

export const StitchRadius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;
