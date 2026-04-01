import type { LearningLevel } from "@/src/features/profile/types/profile.types";

/** Krótki opis poziomu pod tytułem kafelka w ustawieniach. */
export function getLearningLevelShortDescription(
  level: string,
): string | null {
  switch (level as LearningLevel) {
    case "beginner":
      return "Podstawowe słownictwo.";
    case "intermediate":
      return "Słowa na co dzień.";
    case "advanced":
      return "Trudniejsze słowa.";
    default:
      return null;
  }
}
