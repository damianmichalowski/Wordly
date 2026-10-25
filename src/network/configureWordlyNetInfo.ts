import NetInfo from "@react-native-community/netinfo";

let configured = false;

/**
 * Wywołaj raz przed pierwszym `addEventListener` (NetInfo.configure zeruje listenery).
 * Krótszy timeout reachability = szybsze `isInternetReachable === false` przy martwym łączu.
 */
export function configureWordlyNetInfo(): void {
  if (configured) {
    return;
  }
  configured = true;
  NetInfo.configure({
    reachabilityRequestTimeout: 5_000,
    reachabilityShortTimeout: 3_000,
  });
}
