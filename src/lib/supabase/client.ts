import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { env, hasSupabaseEnv as hasConfiguredEnv } from '@/src/lib/supabase/env';
import type { Database } from '@/src/types/database';

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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
