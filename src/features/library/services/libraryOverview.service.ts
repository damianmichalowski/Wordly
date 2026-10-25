import { rpc } from "@/src/lib/supabase/rpc";
import type { LibraryOverview } from "@/src/types/revisionTracking";

export async function getLibraryOverview(): Promise<LibraryOverview> {
  const { data, error } = await rpc("get_library_overview");
  if (error) {
    throw new Error(`get_library_overview failed: ${error.message}`);
  }
  return data as LibraryOverview;
}
