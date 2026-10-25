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
  /** Pierwsze ładowanie listy (gdy `rows` jeszcze null). */
  isInitialLoading: boolean;
  onTrophyPress: (row: UserAchievementRow) => void;
  onSeeAll: () => void;
};

export function SettingsAchievementsSection({
  rows,
  hasLoadError,
  isInitialLoading,
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
      {hasLoadError || isInitialLoading ? (
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
