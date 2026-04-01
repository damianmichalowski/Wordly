import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/src/lib/supabase/client";

type RpcName = Parameters<typeof supabase.rpc>[0];
type RpcArgs<TName extends RpcName> = Parameters<typeof supabase.rpc<TName>>[1];

function formatPostgrestError(err: PostgrestError) {
  return {
    message: err.message,
    details: err.details,
    hint: err.hint,
    code: err.code,
  };
}

/**
 * Wrapper around `supabase.rpc` that logs timing + full error context.
 * Keeps payloads in logs (ids etc.) to make SQL debugging easier during development.
 */
export async function rpc<TName extends RpcName>(
  name: TName,
  args?: RpcArgs<TName>,
) {
  const startedAt = Date.now();
  const label = `[wordly][rpc] ${String(name)}`;
  const shouldLog = __DEV__;

  // Note: avoid logging full session/auth headers; `args` are just the RPC params.
  if (shouldLog) {
    if (args && Object.keys(args as object).length > 0) {
      console.log(`${label} ->`, args);
    } else {
      console.log(`${label} ->`);
    }
  }

  const res = await supabase.rpc(name as any, args as any);

  if (shouldLog) {
    const ms = Date.now() - startedAt;
    if (res.error) {
      console.error(`${label} !! (${ms}ms)`, formatPostgrestError(res.error));
    } else {
      console.log(`${label} ok (${ms}ms)`);
    }
  }

  return res;
}

