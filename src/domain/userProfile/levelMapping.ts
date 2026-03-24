import type { CefrLevel } from "@/src/types/cefr";
import type { DisplayLevelPolicy } from "@/src/types/profile";

const nextLevelMap: Record<CefrLevel, CefrLevel> = {
  A1: "A2",
  A2: "B1",
  B1: "B2",
  B2: "C1",
  C1: "C2",
  C2: "C2",
};

export function deriveDisplayLevel(
  currentLevel: CefrLevel,
  policy: DisplayLevelPolicy = "next-level",
): CefrLevel {
  if (policy === "same-level") {
    return currentLevel;
  }
  if (policy === "advanced-mixed") {
    return currentLevel === "C2" ? "C2" : nextLevelMap[currentLevel];
  }

  return nextLevelMap[currentLevel];
}
