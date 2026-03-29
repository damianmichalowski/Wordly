import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/src/hooks/useColorScheme';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { AppBootstrapProvider } from '@/src/providers/AppBootstrapProvider';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';

void SplashScreen.preventAutoHideAsync();

const WordlyNavigationLight = {
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

const WordlyNavigationDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: StitchColors.primaryContainer,
    background: '#121418',
    card: '#1c1f26',
    text: '#f2f4f4',
    border: '#2f3334',
    notification: StitchColors.primaryContainer,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppBootstrapProvider>
        <RootNavigator />
      </AppBootstrapProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isReady } = useAppBootstrap();
  const colorScheme = useColorScheme();

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? WordlyNavigationDark : WordlyNavigationLight}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor:
              colorScheme === 'dark' ? WordlyNavigationDark.colors.background : StitchColors.surface,
          },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="word/[senseId]" options={{ headerShown: false }} />
        <Stack.Screen name="revision-session-complete" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
