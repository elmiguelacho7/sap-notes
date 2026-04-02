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

/**
 * Headers + user id for authenticated fetch() to same-origin API routes.
 * Uses getUser() (validated) then getSession / refreshSession so Bearer is fresh when possible;
 * cookies are still sent via credentials: "include" for server-side session resolution.
 */
export async function getSupabaseAuthForApiRequest(): Promise<{
  userId: string | null;
  headers: Record<string, string>;
}> {
  const { data: { user }, error } = await supabase.auth.getUser();
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (error || !user?.id) {
    return { userId: null, headers: base };
  }
  let session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session ?? session;
  }
  if (session?.access_token) {
    base.Authorization = `Bearer ${session.access_token}`;
  }
  return { userId: user.id, headers: base };
}
