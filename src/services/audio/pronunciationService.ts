import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

import type { LanguageCode } from '@/src/types/language';
import type { VocabularyWord } from '@/src/types/words';

const languageToLocale: Record<LanguageCode, string> = {
  pl: 'pl-PL',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
};

type ManagedAudioPlayer = ReturnType<typeof createAudioPlayer>;

let activePlayer: ManagedAudioPlayer | null = null;
let activePlaybackSubscription: { remove: () => void } | null = null;

function getTtsText(word: VocabularyWord): string | undefined {
  // Wymowa dotyczy słowa w języku nauki (lemat = sourceText), nie tłumaczenia (targetText).
  const t = word.pronunciationText?.trim() || word.sourceText?.trim();
  return t || undefined;
}

export function canPronounce(word: VocabularyWord | null | undefined) {
  if (!word) {
    return false;
  }
  if (word.audioUrl?.trim()) {
    return true;
  }
  return Boolean(getTtsText(word));
}

async function stopUrlPlayback(): Promise<void> {
  if (activePlaybackSubscription) {
    try {
      activePlaybackSubscription.remove();
    } catch {
      /* noop */
    }
    activePlaybackSubscription = null;
  }
  if (!activePlayer) {
    return;
  }
  const player = activePlayer;
  activePlayer = null;
  try {
    player.pause();
    player.remove();
  } catch {
    // already removed or not playing
  }
}

async function playPronunciationUrl(url: string): Promise<boolean> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
  });
  await stopUrlPlayback();
  try {
    const player = createAudioPlayer(url);
    activePlayer = player;

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded || activePlayer !== player) {
        return;
      }
      if (status.didJustFinish) {
        try {
          subscription.remove();
        } catch {
          /* noop */
        }
        if (activePlaybackSubscription === subscription) {
          activePlaybackSubscription = null;
        }
        try {
          player.pause();
          player.remove();
        } catch {
          /* noop */
        }
        if (activePlayer === player) {
          activePlayer = null;
        }
      }
    });
    activePlaybackSubscription = subscription;

    player.play();
    return true;
  } catch {
    await stopUrlPlayback();
    return false;
  }
}

function speakTts(word: VocabularyWord, text: string): void {
  const locale = languageToLocale[word.sourceLanguageCode] ?? 'en-US';
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    rate: 0.82,
  });
}

export async function speakWord(word: VocabularyWord): Promise<void> {
  const url = word.audioUrl?.trim();
  const text = getTtsText(word);

  if (url) {
    Speech.stop();
    const ok = await playPronunciationUrl(url);
    if (ok) {
      return;
    }
  }

  if (text) {
    speakTts(word, text);
  }
}

export async function stopSpeaking(): Promise<void> {
  Speech.stop();
  await stopUrlPlayback();
}
