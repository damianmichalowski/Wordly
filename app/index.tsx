import { Redirect } from "expo-router";

import { BootstrapRouteShell } from "@/src/components/bootstrap/BootstrapRouteShell";
import { useAppBootstrap } from "@/src/hooks/useAppBootstrap";

/**
 * Route: `/`: onboarding vs główne zakładki po bootstrapie.
 * Przy Supabase: ukończony onboarding bez sesji → ekran logowania (ponowne wejście).
 */
export default function IndexRoute() {
  const { isReady, hasOnboarded, isAuthenticated } = useAppBootstrap();

  if (!isReady) {
    return <BootstrapRouteShell />;
  }

  if (!hasOnboarded) {
    return <Redirect href="/(onboarding)" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
