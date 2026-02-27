/**
 * Log Supabase errors in a structured way.
 * - Ignores null, undefined.
 * - Ignores empty objects {}.
 * - Logs only when error has meaningful code or message (never logs "{}").
 * - Never throws.
 * - Uses a single string argument so console never shows "error {}".
 */
export function handleSupabaseError(context: string, error: unknown): void {
  if (!hasLoggableSupabaseError(error)) return;
  const err = error as { code?: string; message?: string };
  const payload: Record<string, string> = {};
  const code = err?.code;
  const message = err?.message;
  if (code != null && String(code).trim() !== "") payload.code = String(code);
  if (message != null && String(message).trim() !== "") payload.message = String(message);
  if (Object.keys(payload).length === 0) return;
  console.error(`[${context}] error ${JSON.stringify(payload)}`);
}

/** Use before calling handleSupabaseError to skip logging when error has no code/message. */
export function hasLoggableSupabaseError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error === "object" && Object.keys(error as object).length === 0) return false;
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const message = err?.message;
  if (code != null && String(code).trim() !== "") return true;
  if (message != null && String(message).trim() !== "") return true;
  return false;
}
