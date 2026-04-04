import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAppBootstrap } from "@/src/hooks/useAppBootstrap";
import { prefetchAppShellData } from "@/src/lib/query/prefetchAppShell";

/**
 * After session + onboarding are known, warm shared RPC caches in the background.
 */
export function AppShellPrefetch() {
  const { isReady, isAuthenticated, hasOnboarded } = useAppBootstrap();
  const queryClient = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !hasOnboarded || ran.current) {
      return;
    }
    ran.current = true;
    void prefetchAppShellData(queryClient);
  }, [hasOnboarded, isAuthenticated, isReady, queryClient]);

  return null;
}
