import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

const PERSIST_KEY = "WORDLY_RQ_CACHE_V1";

/**
 * AsyncStorage persister for TanStack PersistQueryClientProvider.
 * Only dehydrates known top-level query key families to avoid bloating storage.
 */
export const wordlyAsyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 2000,
});

const PERSISTED_QUERY_ROOTS = new Set([
  "profile",
  "dailyWord",
  "revision",
  "library",
  "learning",
  "words",
  "onboarding",
  "achievements",
]);

export function shouldDehydrateWordlyQuery(query: {
  queryKey: readonly unknown[];
}): boolean {
  const root = query.queryKey[0];
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
}
