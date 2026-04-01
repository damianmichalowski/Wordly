import "react-native-url-polyfill/auto";

import type { SupportedStorage } from "@supabase/auth-js";
import { createClient } from "@supabase/supabase-js";
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

import { env, hasSupabaseEnv as hasConfiguredEnv } from "@/src/lib/env";
import type { Database } from "./database.types";

/**
 * Taka sama logika jak w AsyncStorage RN:
 * nie importujemy AsyncStorage w ciemno, bo jeśli native moduł
 * nie jest obecny w binarce, sam import może rzucić błędem.
 */
function hasNativeAsyncStorage(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  const fromTurbo =
    TurboModuleRegistry.get?.("PlatformLocalStorage") ??
    TurboModuleRegistry.get?.("RNC_AsyncSQLiteDBStorage") ??
    TurboModuleRegistry.get?.("RNCAsyncStorage");

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

function createWebStorage(): SupportedStorage {
  const ls = globalThis.localStorage;

  if (!ls) {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }

  return {
    getItem: async (key) => ls.getItem(key),
    setItem: async (key, value) => {
      ls.setItem(key, value);
    },
    removeItem: async (key) => {
      ls.removeItem(key);
    },
  };
}

/**
 * Web -> localStorage
 * Native -> AsyncStorage, jeśli moduł istnieje
 * Fallback -> in-memory storage
 */
function getAuthStorage(): SupportedStorage {
  if (Platform.OS === "web") {
    return createWebStorage();
  }

  if (!hasNativeAsyncStorage()) {
    if (__DEV__) {
      console.warn(
        "[Wordly] Brak natywnego AsyncStorage w binarce. Sesja Supabase nie przetrwa restartu aplikacji. " +
          "Zainstaluj pody i zbuduj aplikację ponownie.",
      );
    }

    return createMemoryAuthStorage();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-async-storage/async-storage")
    .default as SupportedStorage;
}

let client: ReturnType<typeof createClient<Database>> | null = null;

export function hasSupabaseEnv() {
  return hasConfiguredEnv();
}

export function getSupabaseClient() {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
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

export const supabase = getSupabaseClient();
