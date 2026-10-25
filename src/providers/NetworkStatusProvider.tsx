import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { computeLikelyOffline } from "@/src/network/netInfoPolicy";

type NetworkStatusValue = {
  /** True gdy brak interfejsu lub reachability jawnie false. */
  isLikelyOffline: boolean;
};

const NetworkStatusContext = createContext<NetworkStatusValue | null>(null);

export function NetworkStatusProvider({ children }: PropsWithChildren) {
  const [isLikelyOffline, setIsLikelyOffline] = useState(false);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      setIsLikelyOffline(computeLikelyOffline(state));
    };

    const unsub = NetInfo.addEventListener((s) => apply(s));
    void NetInfo.fetch().then((s) => apply(s));

    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void NetInfo.refresh().then((s) => apply(s));
      }
    });

    return () => {
      unsub();
      appSub.remove();
    };
  }, []);

  /**
   * Po powrocie z offline na iOS zdarzenie NetInfo bywa gubione lub `isInternetReachable`
   * aktualizuje się po `isConnected` — UI zostaje w „offline”. Odświeżamy reachability
   * dopóki pokazujemy offline (niski koszt: tylko w tym stanie).
   */
  useEffect(() => {
    if (!isLikelyOffline) {
      return;
    }
    const tick = () => {
      void NetInfo.refresh().then((s) => {
        setIsLikelyOffline(computeLikelyOffline(s));
      });
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [isLikelyOffline]);

  const value = useMemo(
    () => ({ isLikelyOffline }),
    [isLikelyOffline],
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusValue {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) {
    throw new Error("useNetworkStatus must be used within NetworkStatusProvider");
  }
  return ctx;
}
