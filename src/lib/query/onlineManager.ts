import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

/**
 * Wire React Query's online manager to NetInfo so retries and reconnect behavior
 * match real device connectivity (RN has no browser "online" events).
 */
export function subscribeReactQueryOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    void NetInfo.fetch().then((state) => {
      setOnline(state.isConnected ?? true);
    });
    return NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? true);
    });
  });
}
