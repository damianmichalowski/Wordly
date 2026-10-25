import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import {
  ANDROID_RIPPLE_SURFACE,
  surfacePressStyle,
} from "@/src/components/ui/interaction";
import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import type { VocabularyWord } from "@/src/types/words";
import { libraryStyles as s } from "./libraryStyles";
import { MemoryStatusBadge, resolveMemoryStatus } from "./MemoryStatusBadge";

type Props = {
  item: VocabularyWord;
  onPress: (word: VocabularyWord) => void;
};

export const LibraryWordRow = memo(function LibraryWordRow({
  item,
  onPress,
}: Props) {
  const status = resolveMemoryStatus(item);

  return (
    <Pressable
      android_ripple={ANDROID_RIPPLE_SURFACE}
      style={({ pressed }) => [s.wordRow, surfacePressStyle(pressed, false)]}
      onPress={() => onPress(item)}
    >
      <View style={s.wordRowMain}>
        <Text style={s.wordRowLemma} numberOfLines={1}>
          {item.sourceText}
        </Text>
        <View style={s.wordRowMeta}>
          <View style={s.cefrBadge}>
            <Text style={s.cefrBadgeText}>{item.cefrLevel}</Text>
          </View>
          <MemoryStatusBadge status={status} />
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={StitchColors.outlineVariant}
      />
    </Pressable>
  );
});
