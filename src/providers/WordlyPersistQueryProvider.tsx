import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";

import { queryClient } from "@/src/lib/query/queryClient";
import {
  shouldDehydrateWordlyQuery,
  wordlyAsyncStoragePersister,
} from "@/src/lib/query/wordlyQueryPersister";

export function WordlyPersistQueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: wordlyAsyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        buster: "2026-04-v1",
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydrateWordlyQuery,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
