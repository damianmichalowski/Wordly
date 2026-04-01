import appJson from './app.json';

/**
 * `app.json` pozostaje źródłem prawdy; ten plik tylko dokleja opcjonalne pola z env
 * (np. Apple Team ID dla `@bacons/apple-targets` / podpisu).
 *
 * Ustaw w `.env`: `APPLE_TEAM_ID=XXXXXXXXXX` (10 znaków z developer.apple.com → Membership).
 *
 * Native Google Sign-In: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (plugin wymaga schematu URL);
 * generujemy `com.googleusercontent.apps.<prefix>` z prefiksu client ID (jak REVERSED_CLIENT_ID w Google).
 */
const appleTeamId = process.env.APPLE_TEAM_ID;

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleSignInPlugin: [string, { iosUrlScheme: string }] | null =
  googleIosClientId && googleIosClientId.includes('.apps.googleusercontent.com')
    ? [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com\s*$/i, '')}`,
        },
      ]
    : null;

const basePlugins = (appJson.expo as { plugins?: unknown[] }).plugins ?? [];

export default {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
      usesAppleSignIn: true,
    },
    android: {
      ...appJson.expo.android,
      package: 'com.wordly.mobile',
    },
    plugins: [
      ...basePlugins,
      ...(googleSignInPlugin ? [googleSignInPlugin] : []),
      'expo-apple-authentication',
    ],
  },
};
