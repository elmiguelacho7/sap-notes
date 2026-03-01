import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/me
 * Returns the current user's app_role from profiles. Use when client-side profile read is unreliable (e.g. RLS).
 * Authorization: Bearer token or cookies. Returns 200 with { appRole: string | null } (null when not found or not logged in).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ appRole: null }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ appRole: null }, { status: 200 });
    }

    const appRole = (data as { app_role: string | null }).app_role ?? null;
    return NextResponse.json({ appRole }, { status: 200 });
  } catch (err) {
    console.error("api/me GET error", err);
    return NextResponse.json({ appRole: null }, { status: 200 });
  }
}
