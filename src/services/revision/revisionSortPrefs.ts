import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wordly.revisionSortPrefs";

export type RevisionTimeOrder = "newest" | "oldest";

export type RevisionSortPrefs = {
  timeOrder: RevisionTimeOrder;
};

export const DEFAULT_REVISION_SORT_PREFS: RevisionSortPrefs = {
  timeOrder: "newest",
};

export async function loadRevisionSortPrefs(): Promise<RevisionSortPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_REVISION_SORT_PREFS;
    }
    const parsed = JSON.parse(raw) as Partial<RevisionSortPrefs> & {
      cefrOrder?: unknown;
    };
    return {
      timeOrder: parsed.timeOrder === "oldest" ? "oldest" : "newest",
    };
  } catch {
    return DEFAULT_REVISION_SORT_PREFS;
  }
}

export async function saveRevisionSortPrefs(
  prefs: RevisionSortPrefs,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
