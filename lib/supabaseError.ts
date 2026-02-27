/**
 * Log Supabase errors in a structured way.
 * - Ignores null, undefined.
 * - Ignores empty objects {}.
 * - Logs only when error.code or error.message exist (truthy).
 * - Never logs "{}". Never throws.
 */
export function handleSupabaseError(context: string, error: unknown): void {
  if (error == null) return;
  if (typeof error === "object" && Object.keys(error as object).length === 0) {
    return;
  }
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const message = err?.message;
  const hasCode = code != null && code !== "";
  const hasMessage = message != null && message !== "";
  if (!hasCode && !hasMessage) return;
  console.error(`[${context}] error`, {
    code: hasCode ? code : undefined,
    message: hasMessage ? message : undefined,
  });
}
