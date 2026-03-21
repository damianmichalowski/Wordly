/**
 * Key-value persistence without @react-native-async-storage (avoids
 * "Native module is null, cannot access legacy storage" on some Expo Go / RN builds).
 * Native: single JSON file in documentDirectory. Web: localStorage.
 */
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const KV_FILE_NAME = 'wordly-kv.json';
const WEB_STORAGE_KEY = 'wordly_kv';

async function readMap(): Promise<Record<string, string>> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  const dir = documentDirectory;
  if (!dir) {
    return {};
  }
  const path = `${dir}${KV_FILE_NAME}`;
  const info = await getInfoAsync(path);
  if (!info.exists) {
    return {};
  }
  const raw = await readAsStringAsync(path);
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  const serialized = JSON.stringify(map);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_STORAGE_KEY, serialized);
    }
    return;
  }

  const dir = documentDirectory;
  if (!dir) {
    return;
  }
  const path = `${dir}${KV_FILE_NAME}`;
  await writeAsStringAsync(path, serialized);
}

export async function getItem(key: string): Promise<string | null> {
  const map = await readMap();
  return map[key] ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  const map = await readMap();
  map[key] = value;
  await writeMap(map);
}

export async function removeItem(key: string): Promise<void> {
  const map = await readMap();
  delete map[key];
  await writeMap(map);
}
