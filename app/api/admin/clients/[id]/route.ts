import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ClientRow } from "../route";

type RouteParams = { params: Promise<{ id: string }> };

const CLIENT_SELECT =
  "id, name, legal_name, display_name, tax_id, website, linkedin_url, industry, subindustry, company_size_bucket, employee_range, annual_revenue_range, country, region, preferred_language, timezone, parent_client_id, account_group, account_tier, ownership_type, business_model, main_products_services, sap_relevance_summary, known_pain_points, strategic_notes, is_active, created_at, created_by, updated_at, updated_by";
const CLIENT_SELECT_MINIMAL = "id, name, created_at, created_by";

function toOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  return null;
}
function toOptionalBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  return null;
}

/**
 * GET /api/admin/clients/[id]
 * Fetch one client. Requires manage_clients.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Se requiere el id del cliente." }, { status: 400 });
    }

    let { data, error } = await supabaseAdmin
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("id", id.trim())
      .single();

    if (error && error.code !== "PGRST116") {
      const isColumnError =
        error.code === "42703" ||
        (typeof error.message === "string" && /column .* does not exist/i.test(error.message));
      if (isColumnError) {
        const fallback = await supabaseAdmin
          .from("clients")
          .select(CLIENT_SELECT_MINIMAL)
          .eq("id", id.trim())
          .single();
        if (!fallback.error && fallback.data) {
          return NextResponse.json({ client: fallback.data as ClientRow });
        }
      }
    }

    if (error || !data) {
      if (error?.code === "PGRST116") {
        return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
      }
      console.error("admin/clients/[id] GET error", error);
      return NextResponse.json(
        { error: "Error al cargar el cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ client: data as ClientRow });
  } catch (err) {
    console.error("admin/clients/[id] GET error", err);
    return NextResponse.json(
      { error: "Error al cargar el cliente." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/clients/[id]
 * Update a client (partial). Requires manage_clients.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Se requiere el id del cliente." }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = { updated_by: userId };

    const optionalStrings = [
      "name",
      "legal_name",
      "display_name",
      "tax_id",
      "website",
      "linkedin_url",
      "industry",
      "subindustry",
      "company_size_bucket",
      "employee_range",
      "annual_revenue_range",
      "country",
      "region",
      "preferred_language",
      "timezone",
      "account_group",
      "account_tier",
      "ownership_type",
      "business_model",
      "main_products_services",
      "sap_relevance_summary",
      "known_pain_points",
      "strategic_notes",
    ] as const;
    for (const key of optionalStrings) {
      if (key in body) {
        const v = key === "name" ? toOptionalString(body[key]) ?? undefined : toOptionalString(body[key]);
        if (v !== undefined) updates[key] = v;
      }
    }
    if ("parent_client_id" in body) {
      const v = body.parent_client_id;
      updates.parent_client_id =
        v != null && typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    }
    if ("is_active" in body) {
      const v = toOptionalBool(body.is_active);
      if (v !== null) updates.is_active = v;
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(updates)
      .eq("id", id.trim())
      .select(CLIENT_SELECT)
      .single();

    if (error) {
      console.error("admin/clients/[id] PATCH error", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese nombre." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error al actualizar el cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ client: data as ClientRow });
  } catch (err) {
    console.error("admin/clients/[id] PATCH error", err);
    return NextResponse.json(
      { error: "Error al actualizar el cliente." },
      { status: 500 }
    );
  }
}
