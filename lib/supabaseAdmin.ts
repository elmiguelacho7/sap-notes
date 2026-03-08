// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENV_ERROR_MESSAGE = "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL";

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const urlMissing = !supabaseUrl || String(supabaseUrl).trim() === "";
  const keyMissing = !supabaseServiceKey || String(supabaseServiceKey).trim() === "";
  if (urlMissing || keyMissing) {
    console.error("[supabaseAdmin]", ENV_ERROR_MESSAGE);
    throw new Error(ENV_ERROR_MESSAGE);
  }
  _admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return _admin;
}

/**
 * Server-side only. Use for API routes and backend logic that need to bypass RLS.
 * Lazy-initialized. If env vars are missing, getAdmin() throws with ENV_ERROR_MESSAGE;
 * callers must catch and return JSON (e.g. 503) so the route never crashes.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getAdmin() as unknown as Record<string, unknown>)[prop as string];
  },
});
