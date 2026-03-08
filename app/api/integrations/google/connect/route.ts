import { NextResponse } from "next/server";
import {
  getGoogleAuthUrl,
  isGoogleOAuthConfigured,
} from "@/lib/integrations/googleAuth";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { cookies } from "next/headers";

const STATE_COOKIE_NAME = "google_oauth_state";
const STATE_USER_COOKIE_NAME = "google_oauth_user_id";
const STATE_COOKIE_MAX_AGE = 600; // 10 minutes
const RETURN_URL_COOKIE_NAME = "google_oauth_return_url";

/**
 * GET /api/integrations/google/connect
 * Returns Google OAuth URL as JSON. Caller must send Authorization: Bearer <token>.
 * Optional query: return_url=/admin — after callback, redirect here (same-origin only).
 * Does not redirect; frontend performs window.location.href = response.url.
 */
export async function GET(req: Request) {
  try {
    if (!isGoogleOAuthConfigured()) {
      console.error("[integrations/google/connect] Google OAuth env not set");
      return NextResponse.json(
        { error: "Integración Google no configurada." },
        { status: 503 }
      );
    }

    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) {
      console.warn("[integrations/google/connect] No session (Bearer or cookies)");
      return NextResponse.json(
        { error: "Debes iniciar sesión para conectar Google Drive." },
        { status: 401 }
      );
    }

    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE,
    };
    cookieStore.set(STATE_COOKIE_NAME, state, cookieOpts);
    cookieStore.set(STATE_USER_COOKIE_NAME, userId, cookieOpts);

    const url = new URL(req.url);
    const returnUrl = url.searchParams.get("return_url");
    if (returnUrl && typeof returnUrl === "string" && returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
      cookieStore.set(RETURN_URL_COOKIE_NAME, returnUrl.trim(), { ...cookieOpts, maxAge: STATE_COOKIE_MAX_AGE });
    }

    const authUrl = getGoogleAuthUrl(state);
    return NextResponse.json({ url: authUrl });
  } catch (err) {
    console.error("[integrations/google/connect]", err);
    return NextResponse.json(
      { error: "Error al iniciar la conexión con Google." },
      { status: 500 }
    );
  }
}
