import 'react-native-url-polyfill/auto';

import type { SupportedStorage } from '@supabase/auth-js';
import { createClient } from '@supabase/supabase-js';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { env, hasSupabaseEnv as hasConfiguredEnv } from '@/src/lib/supabase/env';
import type { Database } from '@/src/types/database';

/**
 * Ta sama logika co w `@react-native-async-storage/async-storage/src/RCTAsyncStorage.ts`.
 * Musimy ją powielić, bo sam `import AsyncStorage` rzuca, gdy native nie jest w binarce.
 */
function hasNativeAsyncStorage(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  const fromTurbo =
    TurboModuleRegistry.get?.('PlatformLocalStorage') ??
    TurboModuleRegistry.get?.('RNC_AsyncSQLiteDBStorage') ??
    TurboModuleRegistry.get?.('RNCAsyncStorage');
  const fromLegacy =
    NativeModules.PlatformLocalStorage ??
    NativeModules.RNC_AsyncSQLiteDBStorage ??
    NativeModules.RNCAsyncStorage ??
    NativeModules.AsyncSQLiteDBStorage ??
    NativeModules.AsyncLocalStorage;
  return Boolean(fromTurbo ?? fromLegacy);
}

function createMemoryAuthStorage(): SupportedStorage {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
}

/**
 * Supabase Auth: web → `localStorage`. Native → AsyncStorage **tylko jeśli** moduł jest
 * zlinkowany (inaczej `require` pakietu natychmiast rzuca). Fallback: pamięć (sesja do reloadu).
 */
function getAuthStorage(): SupportedStorage {
  if (Platform.OS === 'web') {
    const ls = globalThis.localStorage;
    if (!ls) {
      return {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      };
    }
    return {
      getItem: (key) => Promise.resolve(ls.getItem(key)),
      setItem: (key, value) => {
        ls.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        ls.removeItem(key);
        return Promise.resolve();
      },
    };
  }

  if (!hasNativeAsyncStorage()) {
    if (__DEV__) {
      console.warn(
        '[Wordly] Brak natywnego AsyncStorage w binarce. Sesja Supabase nie przetrwa restartu aplikacji. ' +
          'Zainstaluj pody i zbuduj ponownie: cd ios && pod install && cd .. && npx expo run:ios',
      );
    }
    return createMemoryAuthStorage();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default as SupportedStorage;
}

let client: ReturnType<typeof createClient<Database>> | null = null;

export function hasSupabaseEnv() {
  return hasConfiguredEnv();
}

export function getSupabaseClient() {
  if (!hasSupabaseEnv()) {
    throw new Error(
      'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  if (!client) {
    client = createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        storage: getAuthStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
