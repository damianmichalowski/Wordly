import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wordly.revisionSortPrefs";

export type RevisionTimeOrder = "newest" | "oldest";
export type RevisionCefrOrder = "none" | "asc" | "desc";

export type RevisionSortPrefs = {
  timeOrder: RevisionTimeOrder;
  cefrOrder: RevisionCefrOrder;
};

export const DEFAULT_REVISION_SORT_PREFS: RevisionSortPrefs = {
  timeOrder: "newest",
  cefrOrder: "none",
};

export async function loadRevisionSortPrefs(): Promise<RevisionSortPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_REVISION_SORT_PREFS;
    }
    const parsed = JSON.parse(raw) as Partial<RevisionSortPrefs>;
    return {
      timeOrder: parsed.timeOrder === "oldest" ? "oldest" : "newest",
      cefrOrder:
        parsed.cefrOrder === "asc" || parsed.cefrOrder === "desc"
          ? parsed.cefrOrder
          : "none",
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
