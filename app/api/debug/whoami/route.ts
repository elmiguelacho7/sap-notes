import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Parse project ref from Supabase URL (e.g. https://abcdefgh.supabase.co -> abcdefgh). */
function getProjectRef(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname ?? "";
    const match = host.match(/^([a-z]+)\.supabase\.co$/i);
    return match ? match[1] : host || "";
  } catch {
    return "";
  }
}

/** Decode JWT payload (safe: no verification, for display only). */
function decodeJwtPayload(token: string): { sub?: string; email?: string; iss?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8")
    ) as { sub?: string; email?: string; iss?: string };
    return {
      sub: payload.sub ?? undefined,
      email: payload.email ?? undefined,
      iss: payload.iss ?? undefined,
    };
  } catch {
    return {};
  }
}

type AuthSource = "bearer" | "cookie" | "none";

/**
 * Resolve access token and auth source: Bearer header first, then cookie-based session.
 * Does not use service_role; uses same user-scoped resolution as the rest of the app.
 */
async function getTokenAndSource(req: Request): Promise<{ token: string | null; source: AuthSource }> {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken) return { token: bearerToken, source: "bearer" };

  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only for whoami; no need to write cookies
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;
  return { token, source: token ? "cookie" : "none" };
}

/**
 * GET /api/debug/whoami
 * Diagnostic: project ref, auth source (bearer | cookie | none), JWT claims, and profile.
 * Resolves session from cookies when opened in browser (no Bearer). Keeps Bearer support.
 */
export async function GET(req: Request) {
  try {
    const { token, source } = await getTokenAndSource(req);
    const projectRef = getProjectRef(supabaseUrl);

    const response: {
      projectRef: string;
      supabaseUrlHost: string;
      authSource: AuthSource;
      jwt: { sub: string | null; email: string | null; iss: string | null };
      profile: {
        id: string;
        email: string | null;
        app_role: string | null;
        is_active: boolean | null;
      } | null;
    } = {
      projectRef,
      supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : "",
      authSource: source,
      jwt: { sub: null, email: null, iss: null },
      profile: null,
    };

    if (!token?.trim()) {
      return NextResponse.json(response);
    }

    const payload = decodeJwtPayload(token);
    response.jwt = {
      sub: payload.sub ?? null,
      email: payload.email ?? null,
      iss: payload.iss ?? null,
    };

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(response);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    if (payload.sub) {
      const subForLookup = payload.sub.length === 37 ? payload.sub.slice(0, 36) : payload.sub;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, app_role, is_active")
        .eq("id", subForLookup)
        .maybeSingle();
      if (profile) {
        response.profile = {
          id: (profile as { id: string }).id,
          email: (profile as { email?: string | null }).email ?? null,
          app_role: (profile as { app_role?: string | null }).app_role ?? null,
          is_active: (profile as { is_active?: boolean | null }).is_active ?? null,
        };
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[debug/whoami] error", err);
    return NextResponse.json(
      { error: "whoami failed" },
      { status: 500 }
    );
  }
}
