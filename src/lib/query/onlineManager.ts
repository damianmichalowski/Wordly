import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

import { computeLikelyOnline } from "@/src/network/netInfoPolicy";

/**
 * Wire React Query's online manager to NetInfo so retries and reconnect behavior
 * match real device connectivity (RN has no browser "online" events).
 */
export function subscribeReactQueryOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    void NetInfo.fetch().then((state) => {
      setOnline(computeLikelyOnline(state));
    });
    return NetInfo.addEventListener((state) => {
      setOnline(computeLikelyOnline(state));
    });
  });
}
