import { DeviceEventEmitter } from "react-native";

/** Po zmianie `user_word_progress` (np. „known” z Daily / widgetu) Revision odświeża listę. */
export const WORD_PROGRESS_UPDATED = "wordly:wordProgressUpdated";

export const WORD_DIFFICULT_TOGGLED = "wordly:wordDifficultToggled";

export type WordDifficultToggledPayload = {
  wordId: string;
  isDifficult: boolean;
  /** When set, syncs session deck counter (e.g. undo back to 1/2). */
  difficultDontKnowCounter?: number;
};

export function emitWordProgressUpdated(): void {
  DeviceEventEmitter.emit(WORD_PROGRESS_UPDATED);
}

export function emitWordDifficultToggled(
  payload: WordDifficultToggledPayload,
): void {
  DeviceEventEmitter.emit(WORD_DIFFICULT_TOGGLED, payload);
}
