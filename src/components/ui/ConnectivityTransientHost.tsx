import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StitchColors, StitchFonts, StitchRadius } from "@/src/theme/wordlyStitchTheme";

const AUTO_HIDE_MS = 2600;
const FADE_MS = 180;

type ToastKind = "offline" | "online";

/**
 * Short-lived, non-blocking top notices for offline / reconnect — no permanent ribbon.
 * Reconnect also resumes paused mutations; React Query refetches active stale queries via `refetchOnReconnect`.
 */
export function ConnectivityTransientHost() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<ToastKind | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const prevConnected = useRef<boolean | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setKind(null);
      }
    });
  }, [opacity]);

  const show = useCallback(
    (next: ToastKind) => {
      clearHideTimer();
      opacity.stopAnimation();
      setKind(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start();
      hideTimerRef.current = setTimeout(() => {
        hide();
      }, AUTO_HIDE_MS);
    },
    [clearHideTimer, hide, opacity],
  );

  useEffect(() => {
    return () => {
      clearHideTimer();
      opacity.stopAnimation();
    };
  }, [clearHideTimer, opacity]);

  useEffect(() => {
    const onState = (state: { isConnected: boolean | null }) => {
      const connected = state.isConnected ?? true;

      if (prevConnected.current === null) {
        prevConnected.current = connected;
        if (!connected) {
          show("offline");
        }
        return;
      }

      if (prevConnected.current === connected) {
        return;
      }

      if (prevConnected.current && !connected) {
        if (__DEV__) {
          console.log("[wordly] connectivity offline transition");
        }
        show("offline");
      } else if (!prevConnected.current && connected) {
        if (__DEV__) {
          console.log(
            "[wordly] connectivity online transition (resumePausedMutations + toast)",
          );
        }
        void queryClient.resumePausedMutations();
        show("online");
      }

      prevConnected.current = connected;
    };

    const unsub = NetInfo.addEventListener(onState);
    void NetInfo.fetch().then((s) => onState(s));
    return () => {
      unsub();
      prevConnected.current = null;
    };
  }, [queryClient, show]);

  if (kind === null) {
    return null;
  }

  const isOffline = kind === "offline";

  return (
    <View
      pointerEvents="none"
      style={[
        styles.host,
        { paddingTop: Math.max(insets.top, 10) + 4 },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.pill, { opacity }]}>
        <MaterialIcons
          name={isOffline ? "wifi-off" : "wifi"}
          size={17}
          color={
            isOffline
              ? StitchColors.onSurfaceVariant
              : StitchColors.primary
          }
          style={styles.icon}
        />
        <Text style={styles.text}>
          {isOffline ? "Brak połączenia" : "Połączenie przywrócone"}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 400,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.full,
    backgroundColor: StitchColors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${StitchColors.outlineVariant}55`,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  icon: {
    marginTop: 0,
  },
  text: {
    fontSize: 13,
    fontFamily: StitchFonts.bodyMedium,
    color: StitchColors.onSurfaceVariant,
    letterSpacing: -0.1,
  },
});
