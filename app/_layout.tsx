import "react-native-gesture-handler";

import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShellPrefetch } from "@/src/components/bootstrap/AppShellPrefetch";
import { ConnectivityTransientHost } from "@/src/components/ui/ConnectivityTransientHost";
import { configureWordlyNetInfo } from "@/src/network/configureWordlyNetInfo";
import { BootstrapRouteShell } from "@/src/components/bootstrap/BootstrapRouteShell";
import { SplashController } from "@/src/components/bootstrap/SplashController";
import { AchievementEventsProvider } from "@/src/features/achievements/AchievementEventsProvider";
import { useColorScheme } from "@/src/hooks/useColorScheme";
import { subscribeReactQueryOnlineManager } from "@/src/lib/query/onlineManager";
import { AppBootstrapProvider } from "@/src/providers/AppBootstrapProvider";
import { NetworkStatusProvider } from "@/src/providers/NetworkStatusProvider";
import { WordlyPersistQueryProvider } from "@/src/providers/WordlyPersistQueryProvider";
import {
  WordlyNavigationDark,
  WordlyNavigationLight,
} from "@/src/theme/navigationTheme";
import { i18n } from "@/src/i18n/i18n";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  configureWordlyNetInfo();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return <BootstrapRouteShell />;
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
      <WordlyPersistQueryProvider>
        <NetworkStatusProvider>
          <ConnectivityTransientHost />
          <ReactQueryOnlineSetup />
          <AppBootstrapProvider>
            <AppShellPrefetch />
            <SplashController fontsLoaded={fontsLoaded} />
            {/* Achievement entry RPC runs here once session is ready (not from Settings). */}
            <AchievementEventsProvider>
              <RootNavigator />
            </AchievementEventsProvider>
          </AppBootstrapProvider>
        </NetworkStatusProvider>
      </WordlyPersistQueryProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

function ReactQueryOnlineSetup() {
  useEffect(() => {
    subscribeReactQueryOnlineManager();
  }, []);
  return null;
}

function RootNavigator() {
  const colorScheme = useColorScheme();

  /**
   * Stack stays mounted for the whole session — no swapping a blank `View` for the navigator
   * when `isReady` flips (that caused a visible blank frame / mini “reload”).
   * While bootstrap runs, `app/index` paints {@link BootstrapRouteShell} instead of `null`.
   */
  return (
    <ThemeProvider
      value={
        colorScheme === "dark" ? WordlyNavigationDark : WordlyNavigationLight
      }
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? WordlyNavigationDark.colors.background
                : StitchColors.surface,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="word/[wordId]" options={{ headerShown: false }} />
        <Stack.Screen
          name="revision-session-complete"
          options={{ headerShown: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
