/**
 * GET /api/admin/knowledge-sources
 * List knowledge sources. Superadmin only.
 * Query: scope=global|project|all (default: global), projectId (optional, for scope=project filter).
 * Returns project_id and project_name for project sources when scope is project or all.
 * Always returns JSON; never throws. Returns { sources: [] } when empty or on error path.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ENV_ERROR_MESSAGE = "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL";

export type GlobalKnowledgeSourceRow = {
  id: string;
  scope_type: string;
  project_id?: string | null;
  project_name?: string | null;
  source_type: string;
  source_name: string;
  external_ref: string | null;
  source_url: string | null;
  status: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  integration_id: string | null;
  created_at: string;
  updated_at: string;
};

const FALLBACK_ERROR = "Error al cargar las fuentes de conocimiento.";

export async function GET(request: NextRequest) {
  try {
    if (!request || typeof request.headers?.get !== "function") {
      console.error("[admin/knowledge-sources] GET invalid request");
      return NextResponse.json({ error: FALLBACK_ERROR }, { status: 500 });
    }

    let userId: string | null = null;
    try {
      userId = await requireSuperAdminFromRequest(request);
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : "Auth check failed";
      if (msg.includes("Missing SUPABASE") || msg === ENV_ERROR_MESSAGE) {
        console.error("[admin/knowledge-sources]", ENV_ERROR_MESSAGE);
        return NextResponse.json({ error: ENV_ERROR_MESSAGE }, { status: 503 });
      }
      console.error("[admin/knowledge-sources] GET auth error", msg);
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const url = request.url ? new URL(request.url) : null;
    const scopeParam = url?.searchParams.get("scope") ?? "global";
    const scope = scopeParam === "project" || scopeParam === "all" ? scopeParam : "global";
    const projectIdFilter = url?.searchParams.get("projectId")?.trim() || null;

    let data: unknown = null;
    let error: { code?: string; message?: string } | null = null;

    const selectFields = "id, scope_type, project_id, source_type, source_name, external_ref, source_url, status, sync_enabled, last_synced_at, integration_id, created_at, updated_at";

    if (scope === "global") {
      const result = await supabaseAdmin
        .from("knowledge_sources")
        .select(selectFields)
        .eq("scope_type", "global")
        .is("project_id", null)
        .order("created_at", { ascending: false });
      data = result.data;
      error = result.error;
    } else if (scope === "project") {
      let query = supabaseAdmin
        .from("knowledge_sources")
        .select(selectFields)
        .eq("scope_type", "project")
        .not("project_id", "is", null)
        .order("created_at", { ascending: false });
      if (projectIdFilter) {
        query = query.eq("project_id", projectIdFilter);
      }
      const result = await query;
      data = result.data;
      error = result.error;
    } else {
      const result = await supabaseAdmin
        .from("knowledge_sources")
        .select(selectFields)
        .order("scope_type", { ascending: true })
        .order("created_at", { ascending: false });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[admin/knowledge-sources] Supabase error", error.code ?? "unknown", error.message ?? "");
      return NextResponse.json({ error: FALLBACK_ERROR }, { status: 500 });
    }

    const list = Array.isArray(data) ? data : [];
    const withProjectId = list as Array<Record<string, unknown> & { project_id?: string | null }>;

    if (withProjectId.length > 0 && (scope === "project" || scope === "all")) {
      const projectIds = Array.from(new Set(withProjectId.map((r) => r.project_id).filter(Boolean))) as string[];
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      const nameById = new Map((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const enriched = withProjectId.map((row) => ({
        ...row,
        project_name: row.project_id ? nameById.get(row.project_id) ?? null : null,
      }));
      return NextResponse.json({ sources: enriched as GlobalKnowledgeSourceRow[] });
    }

    return NextResponse.json({ sources: list as GlobalKnowledgeSourceRow[] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Missing SUPABASE") || msg === ENV_ERROR_MESSAGE) {
      console.error("[admin/knowledge-sources]", ENV_ERROR_MESSAGE);
      return NextResponse.json({ error: ENV_ERROR_MESSAGE }, { status: 503 });
    }
    console.error("[admin/knowledge-sources] Unexpected error", err);
    return NextResponse.json({ error: FALLBACK_ERROR }, { status: 500 });
  }
}

const ALLOWED_SOURCE_TYPES = [
  "google_drive_folder",
  "google_drive_file",
  "sap_help",
  "sap_official",
  "official_web",
  "sharepoint_library",
  "confluence_space",
  "jira_project",
  "web_url",
  "manual_upload",
] as const;

/**
 * POST /api/admin/knowledge-sources
 * Create a global knowledge source. Body: { source_type, source_name (or name), source_url? (or url), external_ref?, integration_id? }.
 * Superadmin only. scope_type = 'global', project_id = null. Always returns JSON; never throws.
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    userId = await requireSuperAdminFromRequest(request);
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : "Auth check failed";
    if (msg.includes("Missing SUPABASE") || msg === ENV_ERROR_MESSAGE) {
      console.error("[admin/knowledge-sources]", ENV_ERROR_MESSAGE);
      return NextResponse.json({ error: ENV_ERROR_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "No autorizado. Solo superadministradores." }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "No autorizado. Solo superadministradores." }, { status: 403 });
  }

  let body: {
    source_type?: string;
    source_name?: string;
    name?: string;
    source_url?: string | null;
    url?: string | null;
    external_ref?: string | null;
    integration_id?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  try {
    const sourceType =
      typeof body.source_type === "string" && ALLOWED_SOURCE_TYPES.includes(body.source_type as (typeof ALLOWED_SOURCE_TYPES)[number])
        ? body.source_type
        : null;
    const sourceName =
      (typeof body.source_name === "string" && body.source_name.trim() !== "" ? body.source_name.trim() : null) ||
      (typeof body.name === "string" && body.name.trim() !== "" ? body.name.trim() : null);

    if (!sourceType || !sourceName) {
      return NextResponse.json(
        { error: "source_type y source_name (o name) son obligatorios." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("knowledge_sources")
      .insert({
        scope_type: "global",
        project_id: null,
        source_type: sourceType,
        source_name: sourceName,
        source_url: typeof body.source_url === "string" ? body.source_url.trim() || null : (typeof body.url === "string" ? body.url.trim() || null : null),
        external_ref: typeof body.external_ref === "string" ? body.external_ref.trim() || null : null,
        integration_id: typeof body.integration_id === "string" && body.integration_id.trim() ? body.integration_id.trim() : null,
        status: "active",
        sync_enabled: true,
        created_by: userId,
      })
      .select("id, scope_type, source_type, source_name, external_ref, source_url, status, sync_enabled, last_synced_at, integration_id, created_at, updated_at")
      .single();

    if (error) {
      console.error("[admin/knowledge-sources] Supabase error", error.code ?? "unknown", error.message ?? "");
      return NextResponse.json({ error: "Error al crear la fuente de conocimiento global." }, { status: 500 });
    }

    return NextResponse.json({ source: data as GlobalKnowledgeSourceRow }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("Missing SUPABASE") || msg === ENV_ERROR_MESSAGE) {
      console.error("[admin/knowledge-sources]", ENV_ERROR_MESSAGE);
      return NextResponse.json({ error: ENV_ERROR_MESSAGE }, { status: 503 });
    }
    console.error("[admin/knowledge-sources] Unexpected error", err);
    return NextResponse.json({ error: "Error al crear la fuente." }, { status: 500 });
  }
}
