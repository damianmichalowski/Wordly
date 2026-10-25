import { DarkTheme, DefaultTheme } from "@react-navigation/native";

import { StitchColors } from "@/src/theme/wordlyStitchTheme";

export const WordlyNavigationLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: StitchColors.primary,
    background: StitchColors.surface,
    card: StitchColors.surfaceContainerLowest,
    text: StitchColors.onSurface,
    border: StitchColors.surfaceContainer,
    notification: StitchColors.primary,
  },
};

export const WordlyNavigationDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: StitchColors.primaryContainer,
    background: "#121418",
    card: "#1c1f26",
    text: "#f2f4f4",
    border: "#2f3334",
    notification: StitchColors.primaryContainer,
  },
};
