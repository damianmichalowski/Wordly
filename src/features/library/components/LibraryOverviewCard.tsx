import { memo } from "react";
import { Text, View } from "react-native";

import type { LibraryOverview } from "@/src/types/revisionTracking";
import { libraryStyles as s } from "./libraryStyles";

type Props = {
  overview: LibraryOverview;
};

const LevelRow = memo(function LevelRow({
  code,
  known,
  target,
}: {
  code: string;
  known: number;
  target: number;
}) {
  const ratio = target > 0 ? Math.min(known / target, 1) : 0;
  return (
    <View style={s.overviewLevelRow}>
      <Text style={s.overviewLevelCode}>{code}</Text>
      <View style={s.overviewLevelTrack}>
        {known > 0 ? (
          <View style={[s.overviewLevelFill, { width: `${ratio * 100}%` }]} />
        ) : null}
      </View>
      <Text style={s.overviewLevelCount}>
        {known}/{target}
      </Text>
    </View>
  );
});

export const LibraryOverviewCard = memo(function LibraryOverviewCard({ overview }: Props) {
  return (
    <View style={s.overviewCard}>
      <View style={s.overviewHeaderRow}>
        <View>
          <Text style={s.overviewKnown}>{overview.knownWords}</Text>
          <Text style={s.overviewKnownLabel}>words known</Text>
        </View>
        {overview.reviewedThisWeek > 0 ? (
          <Text style={s.overviewWeekly}>
            {overview.reviewedThisWeek} reviewed this week
          </Text>
        ) : null}
      </View>

      {overview.byLevel.map((lvl) => (
        <LevelRow
          key={lvl.code}
          code={lvl.code}
          known={lvl.known}
          target={lvl.target}
        />
      ))}
    </View>
  );
});

export function LibraryOverviewSkeleton() {
  return (
    <View style={s.overviewSkeleton}>
      <View style={[s.skeletonLine, s.skeletonShort]} />
      <View style={[s.skeletonLine, s.skeletonMedium]} />
      <View style={[s.skeletonLine, s.skeletonNarrow]} />
      <View style={[s.skeletonLine, s.skeletonMedium]} />
    </View>
  );
}
