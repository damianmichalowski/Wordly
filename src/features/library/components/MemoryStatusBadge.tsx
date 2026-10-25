import { memo } from "react";
import { Text, View } from "react-native";

import { StitchColors } from "@/src/theme/wordlyStitchTheme";
import { libraryStyles as s } from "./libraryStyles";

export type MemoryStatus =
  | "due_today"
  | "due_soon"
  | "needs_practice"
  | "strong"
  | "new"
  | "learning";

const STATUS_CONFIG: Record<
  MemoryStatus,
  { label: string; dotColor: string; labelColor: string; bg: string }
> = {
  due_today: {
    label: "Due today",
    dotColor: StitchColors.error,
    labelColor: StitchColors.error,
    bg: `${StitchColors.error}12`,
  },
  due_soon: {
    label: "Due soon",
    dotColor: StitchColors.primary,
    labelColor: StitchColors.primary,
    bg: `${StitchColors.primary}12`,
  },
  needs_practice: {
    label: "Needs practice",
    dotColor: StitchColors.error,
    labelColor: StitchColors.error,
    bg: `${StitchColors.error}10`,
  },
  strong: {
    label: "Strong",
    dotColor: StitchColors.secondary,
    labelColor: StitchColors.secondary,
    bg: `${StitchColors.secondary}12`,
  },
  new: {
    label: "New",
    dotColor: StitchColors.primary,
    labelColor: StitchColors.primary,
    bg: `${StitchColors.primary}10`,
  },
  learning: {
    label: "Learning",
    dotColor: StitchColors.onSurfaceVariant,
    labelColor: StitchColors.onSurfaceVariant,
    bg: `${StitchColors.onSurfaceVariant}12`,
  },
};

export function resolveMemoryStatus(word: {
  knownAt?: string | null;
  nextReviewAt?: string | null;
  intervalDays?: number;
  isDifficult?: boolean;
}): MemoryStatus {
  if (word.isDifficult) return "needs_practice";

  const now = Date.now();

  if (word.nextReviewAt) {
    const reviewTime = Date.parse(word.nextReviewAt);
    if (Number.isFinite(reviewTime)) {
      if (reviewTime <= now) return "due_today";
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (reviewTime <= now + threeDays) return "due_soon";
    }
  }

  if ((word.intervalDays ?? 0) >= 14) return "strong";

  if (word.knownAt) {
    const knownTime = Date.parse(word.knownAt);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(knownTime) && now - knownTime < sevenDays) return "new";
  }

  return "learning";
}

type Props = {
  status: MemoryStatus;
};

export const MemoryStatusBadge = memo(function MemoryStatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[s.memoryBadge, { backgroundColor: cfg.bg }]}>
      <View style={[s.memoryBadgeDot, { backgroundColor: cfg.dotColor }]} />
      <Text style={[s.memoryBadgeLabel, { color: cfg.labelColor }]}>
        {cfg.label}
      </Text>
    </View>
  );
});
