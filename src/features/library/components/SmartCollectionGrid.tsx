import { memo, useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import type { LibraryCollectionCounts, LibraryCollectionFilter } from "@/src/types/revisionTracking";
import { libraryStyles as s } from "./libraryStyles";

type CollectionDef = {
  key: LibraryCollectionFilter | null;
  label: string;
  countKey: keyof LibraryCollectionCounts | null;
};

const COLLECTIONS: CollectionDef[] = [
  { key: null, label: "All words", countKey: null },
  { key: "recently_learned", label: "Recently learned", countKey: "recentlyLearned" },
  { key: "due_soon", label: "Due soon", countKey: "dueSoon" },
  { key: "need_attention", label: "Needs attention", countKey: "needAttention" },
  { key: "strong_memory", label: "Strong memory", countKey: "strongMemory" },
];

type Props = {
  counts: LibraryCollectionCounts | undefined;
  totalCount: number;
  selected: LibraryCollectionFilter | null;
  onSelect: (collection: LibraryCollectionFilter | null) => void;
};

const CollectionChip = memo(function CollectionChip({
  chipKey,
  label,
  count,
  isSelected,
  onToggle,
}: {
  chipKey: LibraryCollectionFilter | null;
  label: string;
  count: number | undefined;
  isSelected: boolean;
  onToggle: (key: LibraryCollectionFilter | null) => void;
}) {
  const handlePress = useCallback(() => onToggle(chipKey), [chipKey, onToggle]);

  return (
    <Pressable
      style={[s.collectionChip, isSelected && s.collectionChipSelected]}
      onPress={handlePress}
    >
      <Text
        style={[
          s.collectionChipLabel,
          isSelected && s.collectionChipLabelSelected,
        ]}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          style={[
            s.collectionChipCount,
            isSelected && s.collectionChipCountSelected,
          ]}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
});

export const SmartCollectionGrid = memo(function SmartCollectionGrid({
  counts,
  totalCount,
  selected,
  onSelect,
}: Props) {
  const handleToggle = useCallback(
    (key: LibraryCollectionFilter | null) => {
      onSelect(key === selected ? null : key);
    },
    [selected, onSelect],
  );

  return (
    <View style={s.collectionsRow}>
      {COLLECTIONS.map((def) => {
        const count =
          def.countKey == null
            ? totalCount
            : counts?.[def.countKey];
        return (
          <CollectionChip
            key={def.key ?? "all"}
            chipKey={def.key}
            label={def.label}
            count={count}
            isSelected={selected === def.key}
            onToggle={handleToggle}
          />
        );
      })}
    </View>
  );
});
