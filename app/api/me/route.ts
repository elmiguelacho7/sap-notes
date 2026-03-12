import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { hasGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/me
 * Returns the current user's app_role and permission flags for UI consistency with backend enforcement.
 * Authorization: Bearer token or cookies.
 * Returns 200 with { appRole: string | null, permissions?: { manageGlobalNotes: boolean } }.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { appRole: null, permissions: { manageGlobalNotes: false, createProject: false } },
        { status: 200 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { appRole: null, permissions: { manageGlobalNotes: false } },
        { status: 200 }
      );
    }

    const appRole = (data as { app_role: string | null }).app_role ?? null;
    const manageGlobalNotes = await hasGlobalPermission(userId, "manage_global_notes");
    const createProject = await hasGlobalPermission(userId, "create_project");

    return NextResponse.json({
      appRole,
      permissions: { manageGlobalNotes, createProject },
    });
  } catch (err) {
    console.error("api/me GET error", err);
    return NextResponse.json(
      { appRole: null, permissions: { manageGlobalNotes: false, createProject: false } },
      { status: 200 }
    );
  }
}
