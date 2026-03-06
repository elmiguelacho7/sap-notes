import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type IntegrationSummary = {
  id: string;
  provider: string;
  display_name: string;
  account_email: string | null;
  status: string;
  created_at: string;
};

/**
 * GET /api/integrations
 * Returns current user's integrations (no tokens). For UI status and dropdowns.
 */
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Debes iniciar sesión." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("external_integrations")
      .select("id, provider, display_name, account_email, status, created_at")
      .eq("owner_profile_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/integrations] GET error", error);
      return NextResponse.json(
        { error: "Error al cargar integraciones" },
        { status: 500 }
      );
    }

    const integrations = (data ?? []) as IntegrationSummary[];
    return NextResponse.json({ integrations });
  } catch (err) {
    console.error("[api/integrations]", err);
    return NextResponse.json(
      { error: "Error al cargar integraciones" },
      { status: 500 }
    );
  }
}
