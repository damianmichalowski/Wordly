import { LogTag, logger } from "@/src/utils/logger";

function hasPostgrestError(
  value: unknown,
): value is { error: { message?: string } | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as { error: unknown }).error != null
  );
}

/**
 * Wraps a Supabase/PostgREST async call with start/success/error + duration logs.
 */
export async function traceSupabase<T>(
  operationName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = globalThis.performance?.now?.() ?? Date.now();
  logger.info(LogTag.SUPABASE, `${operationName} started`);
  try {
    const result = await fn();
    const ms = (globalThis.performance?.now?.() ?? Date.now()) - t0;
    if (hasPostgrestError(result)) {
      logger.error(
        LogTag.SUPABASE,
        `${operationName} response error (${ms.toFixed(0)}ms)`,
        result.error,
      );
    } else {
      logger.info(
        LogTag.SUPABASE,
        `${operationName} success (${ms.toFixed(0)}ms)`,
      );
    }
    return result;
  } catch (err) {
    const ms = (globalThis.performance?.now?.() ?? Date.now()) - t0;
    logger.error(
      LogTag.SUPABASE,
      `${operationName} failed (${ms.toFixed(0)}ms)`,
      err,
    );
    throw err;
  }
}
