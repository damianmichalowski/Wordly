import type { PostgrestError } from '@supabase/supabase-js'

export function throwIfSupabaseError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`[Supabase] ${context}: ${error.message}`)
  }
}
