import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ANDROID_RIPPLE_PRIMARY,
  primarySolidPressStyle,
} from "@/src/components/ui/interaction";
import {
  TRANSPORT_RETRY_CTA,
  TRANSPORT_RETRY_SUBTITLE,
  TRANSPORT_RETRY_TITLE,
} from "@/src/components/ui/transportRetry.constants";
import {
  StitchColors,
  StitchFonts,
  StitchRadius,
} from "@/src/theme/wordlyStitchTheme";

type TransportRetryVariant = "screen" | "embedded" | "hubBanner";

type TransportRetryMessageProps = {
  variant: TransportRetryVariant;
  onRetry: () => void;
  /** Refetch w toku — ten sam stan błędu, widoczny feedback na CTA. */
  isRetrying?: boolean;
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  /** Domyślnie true dla screen/embedded, false dla paska Huba. */
  showIcon?: boolean;
};

/**
 * Wspólny układ błędu transportu + retry (bez nowych „rodzin” ekranów).
 * Warianty: pełny ekran (zakładki), treść w scrollu/listcie, pasek w Revision Hub.
 */
export function TransportRetryMessage({
  variant,
  onRetry,
  isRetrying = false,
  title = TRANSPORT_RETRY_TITLE,
  subtitle = TRANSPORT_RETRY_SUBTITLE,
  primaryLabel = TRANSPORT_RETRY_CTA,
  showIcon: showIconProp,
}: TransportRetryMessageProps) {
  const showIcon =
    showIconProp ?? (variant === "screen" || variant === "embedded");

  const rootStyle =
    variant === "screen"
      ? styles.rootScreen
      : variant === "embedded"
        ? styles.rootEmbedded
        : styles.rootHubBanner;

  const hubLine =
    variant === "hubBanner" ? `${title}. ${subtitle}` : null;

  return (
    <View style={rootStyle}>
      {showIcon && variant !== "hubBanner" ? (
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={StitchColors.onSurfaceVariant}
          style={styles.icon}
        />
      ) : null}
      {variant === "hubBanner" ? (
        <Text style={styles.subtitleHub}>{hubLine}</Text>
      ) : (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
        disabled={isRetrying}
        android_ripple={ANDROID_RIPPLE_PRIMARY}
        onPress={onRetry}
        style={({ pressed }) => [
          variant === "hubBanner" ? styles.primaryButtonHub : styles.primaryButton,
          primarySolidPressStyle(pressed, isRetrying),
          isRetrying && styles.primaryButtonBusy,
        ]}
      >
        <View style={styles.primaryButtonInner}>
          {isRetrying ? (
            <ActivityIndicator
              size="small"
              color={StitchColors.onPrimary}
              style={styles.spinner}
            />
          ) : null}
          <Text style={styles.primaryButtonText}>
            {isRetrying ? "Wczytywanie…" : primaryLabel}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rootScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
    backgroundColor: StitchColors.surface,
  },
  rootEmbedded: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
    width: "100%",
  },
  rootHubBanner: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: StitchRadius.md,
    backgroundColor: StitchColors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: StitchColors.outlineVariant,
    gap: 10,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    textAlign: "center",
    color: StitchColors.onSurfaceVariant,
    maxWidth: 360,
  },
  subtitleHub: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurface,
    lineHeight: 20,
  },
  primaryButton: {
    alignSelf: "center",
    minWidth: 220,
    maxWidth: 360,
    width: "100%",
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: StitchRadius.xl,
    backgroundColor: StitchColors.primary,
  },
  primaryButtonHub: {
    alignSelf: "flex-start",
    minWidth: 168,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: StitchRadius.lg,
    backgroundColor: StitchColors.primary,
    minHeight: 44,
    justifyContent: "center",
  },
  primaryButtonBusy: {
    opacity: 0.95,
  },
  primaryButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: StitchColors.onPrimary,
    fontFamily: StitchFonts.bodySemi,
    fontSize: 16,
  },
  spinner: {
    marginRight: 0,
  },
});
