/**
 * Log Supabase errors in a structured way. Only logs when error is truthy.
 * Never logs empty objects. Do not throw.
 */
export function handleSupabaseError(context: string, error: unknown): void {
  if (!error || (typeof error === "object" && Object.keys(error).length === 0)) {
    return;
  }
  const err = error as { code?: string; message?: string };
  console.error(`[${context}] error`, {
    code: err?.code,
    message: err?.message,
  });
}
