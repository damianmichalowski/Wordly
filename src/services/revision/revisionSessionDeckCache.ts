import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  encodeRevisionSessionMode,
  type RevisionSessionConfig,
} from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";

const PREFIX = "wordly.revisionHubSessionDeck.v1:";

function cacheKey(config: RevisionSessionConfig): string {
  return `${PREFIX}${encodeRevisionSessionMode(config)}`;
}

export type PersistedRevisionSessionDeck = {
  knownWords: VocabularyWord[];
  flashDeck: VocabularyWord[];
};

export async function persistRevisionSessionDeck(
  config: RevisionSessionConfig,
  knownWords: VocabularyWord[],
  flashDeck: VocabularyWord[],
): Promise<void> {
  if (flashDeck.length === 0) {
    return;
  }
  try {
    const payload: PersistedRevisionSessionDeck = { knownWords, flashDeck };
    await AsyncStorage.setItem(cacheKey(config), JSON.stringify(payload));
  } catch (e) {
    if (__DEV__) {
      console.warn("[wordly] persistRevisionSessionDeck failed", e);
    }
  }
}

export async function clearAllRevisionSessionDecks(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("[wordly] clearAllRevisionSessionDecks failed", e);
    }
  }
}

export async function readRevisionSessionDeck(
  config: RevisionSessionConfig,
): Promise<PersistedRevisionSessionDeck | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(config));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedRevisionSessionDeck;
    if (
      !Array.isArray(parsed?.flashDeck) ||
      parsed.flashDeck.length === 0 ||
      !Array.isArray(parsed?.knownWords)
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    if (__DEV__) {
      console.warn("[wordly] readRevisionSessionDeck failed", e);
    }
    return null;
  }
}
