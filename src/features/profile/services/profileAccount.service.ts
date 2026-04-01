import { supabase } from '@/src/lib/supabase/client'

export async function getAccountEmailOrName(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(`Failed to get account: ${error.message}`)
  }

  const email = data.user?.email ?? data.user?.user_metadata?.full_name
  return typeof email === 'string' ? email : null
}
