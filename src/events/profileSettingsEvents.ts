import { DeviceEventEmitter } from 'react-native';

/** Po udanym „Save settings” Daily / Revision mają przeładować stan z storage. */
export const PROFILE_SETTINGS_SAVED = 'wordly:profileSettingsSaved';

export function emitProfileSettingsSaved(): void {
  DeviceEventEmitter.emit(PROFILE_SETTINGS_SAVED);
}
