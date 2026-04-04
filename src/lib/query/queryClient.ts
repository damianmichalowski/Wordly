import { QueryClient } from "@tanstack/react-query";

/**
 * Shared defaults for a mobile app: avoid refetch storms on tab focus / reconnect
 * unless a screen opts in. Per-query staleTime still applies on top of this.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      /** Data stays fresh long enough to survive typical navigation without refetch. */
      staleTime: 60_000,
      gcTime: 1000 * 60 * 45,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
      /**
       * Default `online` pauses mutations while offline — `mutateAsync` never settles,
       * so local “saving” flags + finally blocks never run. `always` runs the mutation
       * and surfaces network errors immediately so UI can recover without restart.
       */
      networkMode: "always",
    },
  },
});
