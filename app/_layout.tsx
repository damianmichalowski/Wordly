import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { AppBootstrapProvider } from '@/src/providers/AppBootstrapProvider';

export default function RootLayout() {
  return (
    <AppBootstrapProvider>
      <RootNavigator />
    </AppBootstrapProvider>
  );
}

function RootNavigator() {
  const { isReady } = useAppBootstrap();
  const colorScheme = useColorScheme();

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
