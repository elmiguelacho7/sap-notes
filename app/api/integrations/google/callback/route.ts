import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getGoogleOAuthEnv,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  tokenExpiresAt,
} from "@/lib/integrations/googleAuth";

const STATE_COOKIE_NAME = "google_oauth_state";
const FRONTEND_ACCOUNT = "/account";

/**
 * GET /api/integrations/google/callback
 * Handles Google OAuth callback: exchange code, store integration, redirect to account.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  try {
    if (!code || !state) {
      console.error("[integrations/google/callback] Missing code or state");
      return NextResponse.redirect(`${FRONTEND_ACCOUNT}?error=missing_params`);
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
    cookieStore.delete(STATE_COOKIE_NAME);

    if (!storedState || storedState !== state) {
      console.error("[integrations/google/callback] Invalid state");
      return NextResponse.redirect(`${FRONTEND_ACCOUNT}?error=invalid_state`);
    }

    getGoogleOAuthEnv(); // validate env before continuing

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${FRONTEND_ACCOUNT}?error=config`);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Record<string, unknown>)
            );
          } catch {
            // ignore
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.redirect(`${FRONTEND_ACCOUNT}?error=not_authenticated`);
    }

    const ownerProfileId = user.id;

    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    const displayName = userInfo.name?.trim() || "Google Drive";
    const accountEmail = userInfo.email?.trim() || null;
    const expiresAt = tokens.expires_in
      ? tokenExpiresAt(tokens.expires_in).toISOString()
      : null;

    const { data: existing } = await supabaseAdmin
      .from("external_integrations")
      .select("id")
      .eq("owner_profile_id", ownerProfileId)
      .eq("provider", "google_drive")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("external_integrations")
        .update({
          display_name: displayName,
          account_email: accountEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: expiresAt,
          scope: tokens.scope ?? null,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
    } else {
      await supabaseAdmin.from("external_integrations").insert({
        provider: "google_drive",
        owner_profile_id: ownerProfileId,
        display_name: displayName,
        account_email: accountEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
        status: "active",
      });
    }

    return NextResponse.redirect(`${FRONTEND_ACCOUNT}?google=connected`);
  } catch (err) {
    console.error("[integrations/google/callback]", err);
    return NextResponse.redirect(`${FRONTEND_ACCOUNT}?error=callback_failed`);
  }
}
