import { rpc } from "@/src/lib/supabase/rpc";

export type LearningModeType = "difficulty" | "category";

export type LearningTrackProgress = {
  mode: LearningModeType;
  knownCount: number;
  availableCount: number;
  progressPercent: number;
};

export type LearningDifficultyOptionProgress = {
  key: "beginner" | "intermediate" | "advanced";
  knownCount: number;
  availableCount: number;
};

export type LearningCategoryOptionProgress = {
  id: string;
  code: string;
  name: string;
  availableCount: number;
  knownCount: number;
};

export type LearningOptionsProgress = {
  difficulty: LearningDifficultyOptionProgress[];
  categories: LearningCategoryOptionProgress[];
};

/** Tylko liczby słów w katalogu (bez postępu użytkownika), onboarding. */
export type LearningCatalogDifficultyCount = {
  key: "beginner" | "intermediate" | "advanced";
  availableCount: number;
};

export type LearningCatalogCategoryCount = {
  id: string;
  availableCount: number;
};

export type LearningOptionCatalogCounts = {
  difficulty: LearningCatalogDifficultyCount[];
  categories: LearningCatalogCategoryCount[];
};

export async function getLearningTrackProgress(): Promise<LearningTrackProgress> {
  const { data, error } = await rpc("get_learning_track_progress");

  if (error) {
    throw new Error(`Failed to get learning track progress: ${error.message}`);
  }
  if (!data) {
    throw new Error("Learning track progress not found");
  }

  return data as LearningTrackProgress;
}

export async function getLearningOptionsProgress(): Promise<LearningOptionsProgress> {
  const { data, error } = await rpc("get_learning_options_progress");

  if (error) {
    throw new Error(`Failed to get learning options progress: ${error.message}`);
  }
  if (!data) {
    throw new Error("Learning options progress not found");
  }

  return data as LearningOptionsProgress;
}

export async function getLearningOptionCatalogCounts(): Promise<LearningOptionCatalogCounts> {
  const { data, error } = await rpc("get_learning_option_catalog_counts");

  if (error) {
    throw new Error(
      `Failed to get learning option catalog counts: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error("Learning option catalog counts not found");
  }

  return data as LearningOptionCatalogCounts;
}

