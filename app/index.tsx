import { Redirect } from 'expo-router';

import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';

/**
 * Entry `/` — sends user to onboarding or main tabs after local bootstrap.
 */
export default function RootIndex() {
  const { isReady, hasOnboarded } = useAppBootstrap();

  if (!isReady) {
    return null;
  }

  if (hasOnboarded) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(onboarding)" />;
}
