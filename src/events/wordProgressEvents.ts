import { DeviceEventEmitter } from 'react-native';

/** Po zmianie `user_word_progress` (np. „known” z Daily / widgetu) Revision odświeża listę. */
export const WORD_PROGRESS_UPDATED = 'wordly:wordProgressUpdated';

export function emitWordProgressUpdated(): void {
  DeviceEventEmitter.emit(WORD_PROGRESS_UPDATED);
}
