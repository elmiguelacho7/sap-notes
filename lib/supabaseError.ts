/**
 * Log Supabase errors in a structured way.
 * - Ignores null, undefined.
 * - Ignores empty objects {}.
 * - Logs only when error has meaningful code or message (never logs "{}").
 * - Never throws.
 */
export function handleSupabaseError(context: string, error: unknown): void {
  if (error == null) return;
  if (typeof error === "object" && Object.keys(error as object).length === 0) {
    return;
  }
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const message = err?.message;
  const payload: Record<string, string> = {};
  if (code != null && String(code).trim() !== "") payload.code = String(code);
  if (message != null && String(message).trim() !== "") payload.message = String(message);
  if (Object.keys(payload).length === 0) return;
  console.error(`[${context}] error`, payload);
}
