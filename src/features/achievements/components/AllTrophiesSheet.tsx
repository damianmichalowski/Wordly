import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { PageSheetModal } from "@/src/components/ui/PageSheetModal";
import { SettingsTrophyCard } from "@/src/features/achievements/components/SettingsTrophyCard";
import type { UserAchievementRow } from "@/src/features/achievements/services/achievements.service";
import { StitchColors, StitchFonts } from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

type Props = {
  visible: boolean;
  rows: UserAchievementRow[] | null;
  bottomInset: number;
  onClose: () => void;
  onSelectTrophy: (row: UserAchievementRow) => void;
};

/**
 * Renderowany jako **rodzeństwo** głównego `ScrollView` w Ustawieniach (nie wewnątrz przewijanej treści),
 * żeby iOS `pageSheet` zachowywał się jak w Revision Hub (przeciąganie górnej krawędzi).
 */
export function AllTrophiesSheet({
  visible,
  rows,
  bottomInset,
  onClose,
  onSelectTrophy,
}: Props) {
  const open = visible && rows !== null;

  const handleClose = useCallback(() => {
    logUserAction("button_press", { target: "trophies_sheet_close" });
    onClose();
  }, [onClose]);

  const handleSelectTrophy = useCallback(
    (row: UserAchievementRow) => {
      logUserAction("tile_press", {
        target: "trophies_sheet_row",
        trophyId: row.definition.id,
      });
      onSelectTrophy(row);
    },
    [onSelectTrophy],
  );

  return (
    <PageSheetModal visible={open} onRequestClose={handleClose}>
      <View style={styles.page}>
        <ScreenHeader title="All trophies" onBackPress={handleClose} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(32, bottomInset + 24) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {rows && rows.length === 0 ? (
            <Text style={styles.empty}>No trophies yet.</Text>
          ) : null}
          {rows?.map((row) => (
            <SettingsTrophyCard
              key={row.definition.id}
              row={row}
              fullWidth
              onPress={() => handleSelectTrophy(row)}
            />
          ))}
        </ScrollView>
      </View>
    </PageSheetModal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: StitchColors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  empty: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    paddingVertical: 12,
  },
});
