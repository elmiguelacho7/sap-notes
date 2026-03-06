import { NextResponse } from "next/server";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/integrations/googleAuth";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { cookies } from "next/headers";

const STATE_COOKIE_NAME = "google_oauth_state";
const STATE_COOKIE_MAX_AGE = 600; // 10 minutes

/**
 * GET /api/integrations/google/connect
 * Redirects to Google OAuth consent. Caller must be authenticated.
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
      return NextResponse.json(
        { error: "Debes iniciar sesión para conectar Google Drive." },
        { status: 401 }
      );
    }

    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE,
    });

    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[integrations/google/connect]", err);
    return NextResponse.json(
      { error: "Error al iniciar la conexión con Google." },
      { status: 500 }
    );
  }
}
