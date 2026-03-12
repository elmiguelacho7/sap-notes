import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Extended client row for admin (all fields from clients table). */
export type ClientRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  display_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  company_size_bucket?: string | null;
  employee_range?: string | null;
  annual_revenue_range?: string | null;
  country?: string | null;
  region?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  parent_client_id?: string | null;
  account_group?: string | null;
  account_tier?: string | null;
  ownership_type?: string | null;
  business_model?: string | null;
  main_products_services?: string | null;
  sap_relevance_summary?: string | null;
  known_pain_points?: string | null;
  strategic_notes?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const CLIENT_SELECT =
  "id, name, legal_name, display_name, tax_id, website, linkedin_url, industry, subindustry, company_size_bucket, employee_range, annual_revenue_range, country, region, preferred_language, timezone, parent_client_id, account_group, account_tier, ownership_type, business_model, main_products_services, sap_relevance_summary, known_pain_points, strategic_notes, is_active, created_at, created_by, updated_at, updated_by";

/** Minimal select for when extended columns do not exist yet (pre-migration). */
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
 * GET /api/admin/clients
 * List all clients. Requires manage_clients.
 * Tries extended schema first; falls back to minimal (id, name, created_at, created_by) if DB lacks new columns.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;

    let { data, error } = await supabaseAdmin
      .from("clients")
      .select(CLIENT_SELECT)
      .order("name", { ascending: true });

    if (error) {
      const isColumnError =
        error.code === "42703" ||
        (typeof error.message === "string" && /column .* does not exist/i.test(error.message));
      if (isColumnError) {
        const fallback = await supabaseAdmin
          .from("clients")
          .select(CLIENT_SELECT_MINIMAL)
          .order("name", { ascending: true });
        if (fallback.error) {
          console.error("admin/clients GET fallback error", fallback.error);
          return NextResponse.json(
            { error: "Error al cargar los clientes." },
            { status: 500 }
          );
        }
        return NextResponse.json({ clients: (fallback.data ?? []) as ClientRow[] });
      }
      console.error("admin/clients GET error", error);
      return NextResponse.json(
        { error: "Error al cargar los clientes." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clients: (data ?? []) as ClientRow[] });
  } catch (err) {
    console.error("admin/clients GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los clientes." },
      { status: 500 }
    );
  }
}

/** Parsed body for create/update (only allowed fields). */
type ClientPayload = {
  name?: string;
  legal_name?: string | null;
  display_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  company_size_bucket?: string | null;
  employee_range?: string | null;
  annual_revenue_range?: string | null;
  country?: string | null;
  region?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  parent_client_id?: string | null;
  account_group?: string | null;
  account_tier?: string | null;
  ownership_type?: string | null;
  business_model?: string | null;
  main_products_services?: string | null;
  sap_relevance_summary?: string | null;
  known_pain_points?: string | null;
  strategic_notes?: string | null;
  is_active?: boolean | null;
};

function buildInsertFromBody(body: Record<string, unknown>, userId: string): Record<string, unknown> {
  const name = toOptionalString(body.name) ?? toOptionalString(body.display_name) ?? toOptionalString(body.legal_name);
  const row: Record<string, unknown> = {
    name: name ?? "",
    created_by: userId,
    updated_by: userId,
  };
  if (toOptionalString(body.legal_name) != null) row.legal_name = body.legal_name;
  if (toOptionalString(body.display_name) != null) row.display_name = body.display_name;
  if (toOptionalString(body.tax_id) != null) row.tax_id = body.tax_id;
  if (toOptionalString(body.website) != null) row.website = body.website;
  if (toOptionalString(body.linkedin_url) != null) row.linkedin_url = body.linkedin_url;
  if (toOptionalString(body.industry) != null) row.industry = body.industry;
  if (toOptionalString(body.subindustry) != null) row.subindustry = body.subindustry;
  if (toOptionalString(body.company_size_bucket) != null) row.company_size_bucket = body.company_size_bucket;
  if (toOptionalString(body.employee_range) != null) row.employee_range = body.employee_range;
  if (toOptionalString(body.annual_revenue_range) != null) row.annual_revenue_range = body.annual_revenue_range;
  if (toOptionalString(body.country) != null) row.country = body.country;
  if (toOptionalString(body.region) != null) row.region = body.region;
  if (toOptionalString(body.preferred_language) != null) row.preferred_language = body.preferred_language;
  if (toOptionalString(body.timezone) != null) row.timezone = body.timezone;
  if (body.parent_client_id != null && typeof body.parent_client_id === "string" && body.parent_client_id.trim())
    row.parent_client_id = body.parent_client_id.trim();
  if (toOptionalString(body.account_group) != null) row.account_group = body.account_group;
  if (toOptionalString(body.account_tier) != null) row.account_tier = body.account_tier;
  if (toOptionalString(body.ownership_type) != null) row.ownership_type = body.ownership_type;
  if (toOptionalString(body.business_model) != null) row.business_model = body.business_model;
  if (toOptionalString(body.main_products_services) != null) row.main_products_services = body.main_products_services;
  if (toOptionalString(body.sap_relevance_summary) != null) row.sap_relevance_summary = body.sap_relevance_summary;
  if (toOptionalString(body.known_pain_points) != null) row.known_pain_points = body.known_pain_points;
  if (toOptionalString(body.strategic_notes) != null) row.strategic_notes = body.strategic_notes;
  if (toOptionalBool(body.is_active) !== null) row.is_active = body.is_active;
  return row;
}

/**
 * POST /api/admin/clients
 * Create a client. Body: extended ClientPayload; name (or display_name/legal_name) required. Requires manage_clients.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_clients");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const body = (await request.json()) as Record<string, unknown>;
    const name =
      toOptionalString(body.name) ?? toOptionalString(body.display_name) ?? toOptionalString(body.legal_name);

    if (!name || name === "") {
      return NextResponse.json(
        { error: "Se requiere el nombre del cliente (name, display_name o legal_name)." },
        { status: 400 }
      );
    }

    const row = buildInsertFromBody(body, userId);
    row.name = name;

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert(row)
      .select(CLIENT_SELECT)
      .single();

    if (error) {
      console.error("admin/clients POST error", error);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese nombre." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error al crear el cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ client: data as ClientRow });
  } catch (err) {
    console.error("admin/clients POST error", err);
    return NextResponse.json(
      { error: "Error al crear el cliente." },
      { status: 500 }
    );
  }
}
