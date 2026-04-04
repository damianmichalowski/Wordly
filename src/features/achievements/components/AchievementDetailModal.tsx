import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { UserAchievementRow } from "@/src/features/achievements/services/achievements.service";
import { resolveAchievementIonicon } from "@/src/features/achievements/utils/resolveAchievementIonicon";
import {
    StitchColors,
    StitchFonts,
    StitchRadius,
} from "@/src/theme/wordlyStitchTheme";
import { logUserAction } from "@/src/utils/userActionLog";

export function AchievementDetailModal({
  row,
  onClose,
}: {
  row: UserAchievementRow | null;
  onClose: () => void;
}) {
  const handleClose = useCallback(() => {
    if (row) {
      logUserAction("button_press", {
        target: "achievement_detail_close",
        trophyId: row.definition.id,
      });
    }
    onClose();
  }, [row, onClose]);

  return (
    <Modal
      visible={row !== null}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        {row ? (
          <View style={styles.modalCard}>
            <View style={styles.iconRing}>
              <Ionicons
                name={resolveAchievementIonicon(row)}
                size={40}
                color={
                  row.unlocked
                    ? StitchColors.secondary
                    : StitchColors.onSurfaceVariant
                }
              />
            </View>
            <Text style={styles.modalTitle}>{row.definition.title}</Text>
            <Text style={styles.modalType}>
              {row.definition.type === "known_words" ? "Known words" : "Streak"}
              {" · "}
              {row.definition.threshold}
            </Text>
            {row.definition.description ? (
              <Text style={styles.modalBody}>{row.definition.description}</Text>
            ) : (
              <Text style={styles.modalBodyMuted}>
                {row.unlocked
                  ? "You unlocked this trophy."
                  : `Progress: ${row.progressCurrent} / ${row.definition.threshold}`}
              </Text>
            )}
            <Pressable style={styles.modalClose} onPress={handleClose}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 25, 0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: StitchRadius.xl,
    backgroundColor: StitchColors.surfaceContainerLowest,
    padding: 24,
    gap: 10,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 193, 7, 0.12)",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: StitchFonts.headline,
    color: StitchColors.onSurface,
  },
  modalType: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
  },
  modalBody: {
    fontSize: 15,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurface,
    lineHeight: 22,
  },
  modalBodyMuted: {
    fontSize: 14,
    fontFamily: StitchFonts.body,
    color: StitchColors.onSurfaceVariant,
    lineHeight: 20,
  },
  modalClose: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontFamily: StitchFonts.bodySemi,
    color: StitchColors.primary,
  },
});
