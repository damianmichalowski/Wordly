/**
 * Jedna heurystyka „offline” dla UI, React Query `onlineManager` i sesji Revision Hub.
 *
 * Gdy `isConnected === true`, **nie** traktujemy `isInternetReachable === false` jako
 * offline: po włączeniu radia probe reachability bywa opóźniony względem samego
 * linku — wtedy UI i RQ zostałyby „klejone” w offline mimo działającej sieci.
 *
 * Symetrycznie: gdy `isInternetReachable === true`, **nie** traktujemy `isConnected === false`
 * jako offline — po powrocie online iOS bywa kolejność odwrotna (flaga połączenia opóźniona
 * względem pozytywnego reachability). Bez tego `NetInfo.refresh()` w pętli nie zdejmie tagu.
 *
 * Jawne `isInternetReachable === false` używamy tylko gdy `isConnected` nie jest
 * jeszcze potwierdzone (`null`), żeby wciąż łapać „martwe” interfejsy bez szybkiego
 * false na samym radiu.
 */
export function computeLikelyOffline(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isInternetReachable === true) {
    return false;
  }
  if (state.isConnected === false) {
    return true;
  }
  if (state.isConnected === true) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return true;
  }
  return false;
}

export function computeLikelyOnline(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return !computeLikelyOffline(state);
}
