import { getSupabaseClient, hasSupabaseEnv } from "@/src/lib/supabase/client";

/** Zwraca `auth.users.id` z aktualnej sesji (Google / Apple / inna metoda Supabase Auth). */
export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user?.id ?? null;
}
