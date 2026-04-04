import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  TRANSPORT_RETRY_SUBTITLE,
  TRANSPORT_RETRY_TITLE,
} from "@/src/components/ui/transportRetry.constants";
import { SettingsTrophyCard } from "@/src/features/achievements/components/SettingsTrophyCard";
import type { UserAchievementRow } from "@/src/features/achievements/services/achievements.service";
import { buildAchievementSliderItems } from "@/src/features/achievements/utils/buildAchievementSliderItems";
import {
  StitchColors,
  StitchFonts,
} from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

type Props = {
  rows: UserAchievementRow[] | null;
  hasLoadError: boolean;
  /** Pierwsze ładowanie listy (gdy `rows` jeszcze null) — osobno od błędu, żeby offline nie wyglądał jak spinner w nieskończoność. */
  isInitialLoading: boolean;
  /** Retry RPC w toku — ten sam stan błędu, widoczny feedback. */
  retryBusy?: boolean;
  onRetryLoad?: () => void;
  onTrophyPress: (row: UserAchievementRow) => void;
  onSeeAll: () => void;
};

export function SettingsAchievementsSection({
  rows,
  hasLoadError,
  isInitialLoading,
  retryBusy = false,
  onRetryLoad,
  onTrophyPress,
  onSeeAll,
}: Props) {
  const sliderItems = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return buildAchievementSliderItems(rows, 5);
  }, [rows]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>Trophies</Text>
      {hasLoadError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorTitle}>{TRANSPORT_RETRY_TITLE}</Text>
          <Text style={styles.errorSubtitle}>{TRANSPORT_RETRY_SUBTITLE}</Text>
          {onRetryLoad ? (
            <Pressable
              disabled={retryBusy}
              accessibilityState={{ busy: retryBusy }}
              onPress={() => {
                logUserAction("button_press", {
                  target: "settings_trophies_retry",
                });
                onRetryLoad();
              }}
              style={({ pressed }) => [
                styles.retryRow,
                pressed && !retryBusy && { opacity: 0.7 },
              ]}
            >
              {retryBusy ? (
                <ActivityIndicator
                  size="small"
                  color={StitchColors.primary}
                  style={styles.retrySpinner}
                />
              ) : null}
              <Text style={styles.retryTextLabel}>
                {retryBusy ? "Wczytywanie…" : "Spróbuj ponownie"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : isInitialLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={StitchColors.primary} />
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sliderContent}
          >
            {sliderItems.map((item, i) => (
              <SettingsTrophyCard
                key={`${item.row.definition.id}-${item.kind}-${i}`}
                row={item.row}
                compact
                onPress={() => {
                  logUserAction("tile_press", {
                    target: "settings_trophies_slider",
                    trophyId: item.row.definition.id,
                  });
                  onTrophyPress(item.row);
                }}
              />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => {
              logUserAction("button_press", {
                target: "settings_trophies_see_all",
              });
              onSeeAll();
            }}
            style={({ pressed }) => [
              styles.seeAll,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={StitchColors.primary}
            />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    width: "100%",
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
    paddingHorizontal: 4,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.onSurface,
  },
  errorSubtitle: {
    fontSize: 13,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 18,
  },
  errorBlock: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  retrySpinner: {
    marginRight: 0,
  },
  retryTextLabel: {
    fontSize: 14,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
  sliderContent: {
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontSize: 15,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
});
