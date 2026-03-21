import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="language-pair" options={{ title: 'Language Pair' }} />
        <Stack.Screen name="level" options={{ title: 'Your Level' }} />
        <Stack.Screen name="summary" options={{ title: 'Summary' }} />
      </Stack>
    </OnboardingProvider>
  );
}
