import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Creates a Supabase client that uses the current request's cookies (session).
 * Use in API routes and server code where you need the authenticated user.
 */
async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored when called from Server Component or during response
          }
        },
      },
    }
  );
}

/**
 * Returns the current authenticated user's id from the session (cookies), or null.
 */
export async function getCurrentUserId(_request?: NextRequest): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Returns the current user's id from the request, using either:
 * - Authorization: Bearer <jwt> header (when session is in localStorage and client sends token), or
 * - Cookies (when using @supabase/ssr cookie-based session).
 * Use this in API routes so admin panel works with client-side session.
 */
export async function getCurrentUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (!error && user) return user.id;
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Returns the current user's id only if their profile has app_role === 'superadmin'.
 * Otherwise returns null (caller should respond with 403).
 */
export async function requireSuperAdmin(_request?: NextRequest): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .single();

  if (error || !data || data.app_role !== "superadmin") return null;
  return userId;
}

/**
 * Same as requireSuperAdmin but reads user from the request (Bearer token or cookies).
 * Use in admin API route handlers and pass the request.
 */
export async function requireSuperAdminFromRequest(request: Request): Promise<string | null> {
  const userId = await getCurrentUserIdFromRequest(request);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .single();

  if (error || !data || data.app_role !== "superadmin") return null;
  return userId;
}

export type AppRoleFromRequest = "superadmin" | "consultant";

/**
 * Returns the current user id and app_role from the request (Bearer or cookies).
 * Use for routes that need to allow superadmin or project owner.
 */
export async function getCurrentUserWithRoleFromRequest(
  request: Request
): Promise<{ userId: string; appRole: AppRoleFromRequest } | null> {
  const userId = await getCurrentUserIdFromRequest(request);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  const appRole = data.app_role === "superadmin" ? "superadmin" : "consultant";
  return { userId, appRole };
}

/**
 * Returns true if the user is an owner of the project (project_members.role = 'owner').
 */
export async function isProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { role: string }).role === "owner";
}
