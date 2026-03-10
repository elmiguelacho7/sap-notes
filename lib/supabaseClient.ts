/**
 * Browser Supabase client. Uses @supabase/ssr so the session is stored in cookies,
 * enabling API routes (e.g. /api/debug/whoami) to resolve the same session when
 * the user opens them directly in the browser.
 * Use only in Client Components.
 */
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
