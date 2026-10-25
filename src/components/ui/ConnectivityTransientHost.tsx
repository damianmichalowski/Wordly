import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { computeLikelyOnline } from "@/src/network/netInfoPolicy";

/**
 * Brak UI — tylko wznawianie wstrzymanych mutacji po powrocie online; React Query sam
 * odświeża aktywne zapytania przez `refetchOnReconnect`.
 */
export function ConnectivityTransientHost() {
  const queryClient = useQueryClient();
  const prevConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const onState = (state: Parameters<typeof computeLikelyOnline>[0]) => {
      const connected = computeLikelyOnline(state);

      if (prevConnected.current === null) {
        prevConnected.current = connected;
        return;
      }

      if (prevConnected.current === connected) {
        return;
      }

      if (!prevConnected.current && connected) {
        if (__DEV__) {
          console.log(
            "[wordly] connectivity online (resumePausedMutations)",
          );
        }
        void queryClient.resumePausedMutations();
      }

      prevConnected.current = connected;
    };

    const unsub = NetInfo.addEventListener(onState);
    void NetInfo.fetch().then((s) => onState(s));
    return () => {
      unsub();
      prevConnected.current = null;
    };
  }, [queryClient]);

  return null;
}
