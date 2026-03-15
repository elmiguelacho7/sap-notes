/**
 * GET /api/knowledge/explore
 * Aggregated knowledge for the Knowledge Explorer: notes (global + project), documents (knowledge pages),
 * governance decisions (decision-type pages), SAP sources count.
 * Requires auth. Scopes notes and knowledge by user's access (view_global_notes, project membership).
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { hasGlobalPermission } from "@/lib/auth/permissions";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type KnowledgeItemType = "note" | "document" | "governance" | "sap_source";

export type KnowledgeScope = "global" | "project" | "external";

export type KnowledgeExploreItem = {
  id: string;
  type: KnowledgeItemType;
  scope: KnowledgeScope;
  title: string;
  summary: string | null;
  href: string;
  module: string | null;
  createdAt: string;
  projectId?: string | null;
  projectName?: string | null;
};

export type KnowledgeExploreMetrics = {
  totalNotes: number;
  totalDocuments: number;
  governanceDecisions: number;
  sapSources: number;
};

export type KnowledgeExploreResponse = {
  metrics: KnowledgeExploreMetrics;
  items: KnowledgeExploreItem[];
};

const MAX_ITEMS = 500;

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId?.trim()) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const [viewGlobalNotes, manageKnowledgeSources, projectIds] = await Promise.all([
      hasGlobalPermission(userId, "view_global_notes"),
      hasGlobalPermission(userId, "manage_knowledge_sources"),
      getUserProjectIds(userId),
    ]);

    const metrics: KnowledgeExploreMetrics = {
      totalNotes: 0,
      totalDocuments: 0,
      governanceDecisions: 0,
      sapSources: 0,
    };

    const items: KnowledgeExploreItem[] = [];

    // --- Notes: global (if view_global_notes) + project notes ---
    const noteConditions: string[] = [];
    if (viewGlobalNotes) {
      noteConditions.push("project_id.is.null");
    }
    if (projectIds.length > 0) {
      noteConditions.push(`project_id.in.(${projectIds.join(",")})`);
    }
    if (noteConditions.length > 0) {
      const { data: notesData } = await supabaseAdmin
        .from("notes")
        .select("id, title, body, extra_info, module, project_id, created_at")
        .is("deleted_at", null)
        .or(noteConditions.join(","))
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS);

      const notes = notesData ?? [];
      metrics.totalNotes = notes.length;

      const projectIdsForNames = Array.from(new Set(notes.map((n: { project_id?: string | null }) => n.project_id).filter(Boolean))) as string[];
      let projectNamesMap = new Map<string, string>();
      if (projectIdsForNames.length > 0) {
        const { data: projNames } = await supabaseAdmin
          .from("projects")
          .select("id, name")
          .in("id", projectIdsForNames);
        (projNames ?? []).forEach((r: { id: string; name?: string | null }) => projectNamesMap.set(r.id, r.name ?? ""));
      }

      notes.forEach((n: { id: string; title: string | null; body: string | null; extra_info: string | null; module: string | null; project_id: string | null; created_at: string }) => {
        const summary = (n.body ?? n.extra_info ?? "").trim().slice(0, 200) || null;
        const scope: KnowledgeScope = n.project_id ? "project" : "global";
        items.push({
          id: n.id,
          type: "note",
          scope,
          title: n.title ?? "Untitled",
          summary: summary ? (summary.length >= 200 ? summary + "…" : summary) : null,
          href: `/notes/${n.id}`,
          module: n.module ?? null,
          createdAt: n.created_at,
          projectId: n.project_id,
          projectName: n.project_id ? projectNamesMap.get(n.project_id) ?? null : null,
        });
      });
    }

    // --- Knowledge spaces: global (if viewGlobalNotes) + user's projects ---
    let spaceFilter: string;
    if (projectIds.length === 0) {
      spaceFilter = viewGlobalNotes ? "project_id.is.null" : "id.eq.00000000-0000-0000-0000-000000000000";
    } else {
      spaceFilter = viewGlobalNotes
        ? `project_id.is.null,project_id.in.(${projectIds.join(",")})`
        : `project_id.in.(${projectIds.join(",")})`;
    }
    const { data: spacesData } = await supabaseAdmin
      .from("knowledge_spaces")
      .select("id, name, project_id")
      .or(spaceFilter);

    const spaces = spacesData ?? [];
    const spaceIds = spaces.map((s: { id: string }) => s.id);
    const spaceMap = new Map<string, { name: string; project_id: string | null }>();
    spaces.forEach((s: { id: string; name: string; project_id: string | null }) => spaceMap.set(s.id, { name: s.name, project_id: s.project_id }));

    if (spaceIds.length > 0) {
      const { data: pagesData } = await supabaseAdmin
        .from("knowledge_pages")
        .select("id, title, summary, page_type, space_id, created_at")
        .in("space_id", spaceIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(MAX_ITEMS);

      const pages = pagesData ?? [];
      metrics.totalDocuments = pages.length;
      metrics.governanceDecisions = pages.filter((p: { page_type: string }) => p.page_type === "decision").length;

      pages.forEach((p: { id: string; title: string | null; summary: string | null; page_type: string; space_id: string; created_at: string }) => {
        const isGovernance = p.page_type === "decision";
        const summaryTrim = (p.summary ?? "").trim().slice(0, 200) || null;
        const spaceInfo = spaceMap.get(p.space_id);
        const scope: KnowledgeScope = spaceInfo?.project_id ? "project" : "global";
        items.push({
          id: p.id,
          type: isGovernance ? "governance" : "document",
          scope,
          title: p.title ?? "Untitled",
          summary: summaryTrim ? (summaryTrim.length >= 200 ? summaryTrim + "…" : summaryTrim) : null,
          href: `/knowledge/${p.id}`,
          module: null,
          createdAt: p.created_at,
        });
      });
    }

    // --- SAP sources (count + items if permitted) ---
    if (manageKnowledgeSources) {
      const { data: sourcesData, count } = await supabaseAdmin
        .from("knowledge_sources")
        .select("id, source_name, source_url, created_at", { count: "exact" })
        .eq("scope_type", "global")
        .is("project_id", null)
        .order("created_at", { ascending: false })
        .limit(MAX_ITEMS);

      const sources = sourcesData ?? [];
      metrics.sapSources = count ?? sources.length;

      sources.forEach((s: { id: string; source_name: string; source_url: string | null; created_at: string }) => {
        items.push({
          id: s.id,
          type: "sap_source",
          scope: "external",
          title: s.source_name ?? "SAP source",
          summary: s.source_url ? `Source: ${s.source_url}` : null,
          href: s.source_url ?? "#",
          module: null,
          createdAt: s.created_at,
        });
      });
    }

    // Sort all items by createdAt desc
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      metrics,
      items: items.slice(0, MAX_ITEMS),
    } as KnowledgeExploreResponse);
  } catch (err) {
    console.error("[api/knowledge/explore] error", err);
    return NextResponse.json(
      { error: "Failed to load knowledge" },
      { status: 500 }
    );
  }
}
