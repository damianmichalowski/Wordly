import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="language-pair" options={{ headerShown: false }} />
        <Stack.Screen name="level" options={{ headerShown: false }} />
        <Stack.Screen name="widget" options={{ headerShown: false }} />
      </Stack>
    </OnboardingProvider>
  );
}
