import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type AuthSource = "bearer" | "cookie" | "none";

/** Resolve token and auth source for debug (Bearer first, then cookie). */
async function getTokenAndSource(req: Request): Promise<{ token: string | null; source: AuthSource }> {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken) return { token: bearerToken, source: "bearer" };
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;
  return { token, source: token ? "cookie" : "none" };
}

/** Decode JWT payload without verification (for logging only). Returns sub and email. */
function decodeJwtPayload(token: string): { userId: string | null; email: string | null } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { userId: null, email: null };
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8")
    ) as { sub?: string; email?: string };
    return {
      userId: payload.sub ?? null,
      email: payload.email ?? null,
    };
  } catch {
    return { userId: null, email: null };
  }
}

/**
 * GET /api/notes
 * Returns global notes (project_id IS NULL) for the current user.
 * Consultants must NOT receive global notes: we return [] without querying (defense in depth).
 * Creates a Supabase client with the user's JWT so RLS is enforced.
 */
export async function GET(req: Request) {
  try {
    const { token, source: authSource } = await getTokenAndSource(req);
    if (!token?.trim()) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { userId: jwtUserId, email } = decodeJwtPayload(token);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const userId = jwtUserId;
    let appRole: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("app_role")
        .eq("id", userId)
        .maybeSingle();
      appRole = (profile as { app_role?: string } | null)?.app_role ?? null;
    }

    // Critical: consultant must NOT receive global notes (project_id IS NULL).
    if (appRole === "consultant") {
      console.debug("[api/notes] GET", {
        authSource,
        jwtSub: jwtUserId,
        jwtEmail: email,
        app_role: appRole,
        notesCount: 0,
        noteIds: [],
        guard: "consultant_return_empty",
      });
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .is("project_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/notes] GET error", error);
      return NextResponse.json(
        { error: "Failed to load notes" },
        { status: 500 }
      );
    }

    const list = data ?? [];
    const noteIds = list.map((r) => (r as { id: string }).id);
    const notesCount = list.length;
    console.debug("[api/notes] GET", {
      authSource,
      jwtSub: jwtUserId,
      jwtEmail: email,
      app_role: appRole,
      notesCount,
      noteIds,
    });

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/notes] GET error", err);
    return NextResponse.json(
      { error: "Failed to load notes" },
      { status: 500 }
    );
  }
}
