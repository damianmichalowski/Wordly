import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { useAppBootstrap } from "@/src/hooks/useAppBootstrap";

/**
 * Keeps the native splash visible until fonts and bootstrap (session / onboarding flags)
 * are ready — avoids a blank frame between hiding splash and painting the navigator.
 */
export function SplashController({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isReady } = useAppBootstrap();

  useEffect(() => {
    if (fontsLoaded && isReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isReady]);

  return null;
}
