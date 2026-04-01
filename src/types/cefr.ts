export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof cefrLevels)[number];

/** Trzy poziomy w filtrze biblioteki, mapowanie na przedziały CEFR. */
export const libraryLevelTiers = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type LibraryLevelTier = (typeof libraryLevelTiers)[number];

export const LIBRARY_TIER_CEFR_LEVELS: Record<LibraryLevelTier, CefrLevel[]> = {
  beginner: ["A1", "A2"],
  intermediate: ["B1", "B2"],
  advanced: ["C1", "C2"],
};

export const LIBRARY_TIER_LABEL: Record<LibraryLevelTier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
