import appJson from "./app.json";

/**
 * iOS / widget (App Groups)
 * -------------------------
 * Domyślnie: **widget + App Groups włączone** (`targets/widget/`, `@bacons/apple-targets`).
 * Wyłączenie tylko do debugu (bez extension): `EXPO_NO_WIDGET=1` przed `expo prebuild`.
 *
 * Signing (Personal Team lub paid):
 * - Ustaw `APPLE_TEAM_ID` w `.env` (10 znaków) — Expo wstrzykuje `developmentTeam` do projektu Xcode.
 *
 * Google Sign-In (iOS):
 * - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — plugin `@react-native-google-signin/google-signin` dodaje URL scheme.
 *
 * Sign in with Apple: **nieużywane** — brak `expo-apple-authentication`, brak capability w projekcie.
 */
const appleTeamId = process.env.APPLE_TEAM_ID?.trim();

/** Tylko gdy celowo budujesz apke bez extension (np. szybki test). Domyślnie = z widgetem. */
const excludeWidgetTarget =
  process.env.EXPO_NO_WIDGET === "1" ||
  process.env.EXPO_PUBLIC_NO_WIDGET === "1";

const includeWidgetTarget = !excludeWidgetTarget;

const WIDGET_APP_GROUP = "group.com.damianmichalowski.wordly";

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleSignInPlugin: [string, { iosUrlScheme: string }] | null =
  googleIosClientId && googleIosClientId.includes(".apps.googleusercontent.com")
    ? [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com\s*$/i, "")}`,
        },
      ]
    : null;

function withoutAppleTargetsPlugin(plugins: unknown[]): unknown[] {
  return plugins.filter((p) => {
    if (p === "@bacons/apple-targets") {
      return false;
    }
    if (Array.isArray(p) && p[0] === "@bacons/apple-targets") {
      return false;
    }
    return true;
  });
}

const basePlugins = withoutAppleTargetsPlugin(
  (appJson.expo as { plugins?: unknown[] }).plugins ?? [],
);

export default {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
      /** Jawne wyłączenie capability „Sign in with Apple” w generowanym projekcie. */
      usesAppleSignIn: false,
      ...(includeWidgetTarget
        ? {
            entitlements: {
              "com.apple.security.application-groups": [WIDGET_APP_GROUP],
            },
          }
        : {}),
    },
    android: {
      ...appJson.expo.android,
      package: "com.wordly.mobile",
    },
    plugins: [
      ...basePlugins,
      ...(includeWidgetTarget ? ["@bacons/apple-targets"] : []),
      ...(googleSignInPlugin ? [googleSignInPlugin] : []),
    ],
  },
};
