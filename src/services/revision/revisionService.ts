/**
 * Re-export layer — implementation lives in {@link @/src/services/knownWordsService}.
 */
export {
  fetchKnownWordsRevisionBundle,
  getKnownWordsForRevision,
  getKnownWordsSortedByNewest,
  loadKnownWordsRevisionBundleFromRemote,
  markWordReviewed,
  removeFromKnown,
  type KnownWordsRevisionBundle,
} from "@/src/services/knownWordsService";
