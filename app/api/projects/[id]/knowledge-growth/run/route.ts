import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProjectNotes } from "@/lib/services/projectService";
import { extractKnowledgeItemsFromText } from "@/lib/ai/knowledgeGrowthExtractor";
import { storeStructuredProjectMemoryItems } from "@/lib/ai/projectMemoryStore";
import { storeProjectMemory, extractKnowledgeFromTicket } from "@/lib/ai/projectMemory";

type RouteParams = { params: Promise<{ id: string }> };

type RunBody = {
  /** Safety limit: how many notes/pages/tickets to scan (each). */
  limit?: number;
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" ? n : typeof n === "string" ? parseInt(n, 10) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

/**
 * Phase 2: Knowledge Growth Engine run (project-scoped).
 *
 * Incremental + safe:
 * - Requires project permission manage_project_knowledge.
 * - Extracts structured memory from: notes, knowledge pages (summaries), ticket resolutions, and connected docs snippets.
 * - Uses existing storage:
 *   - project_memory (structured items)
 *   - project_knowledge_memory (embedded record; ticket path already uses this)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "manage_project_knowledge");
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = (await req.json().catch(() => ({}))) as RunBody;
    const limit = clampInt(body.limit, 5, 40, 20);

    let extractedCount = 0;
    let embeddedCount = 0;

    // 1) Project notes → structured project_memory items
    const notesResult = await getProjectNotes(projectId, limit);
    for (const n of notesResult.notes) {
      const noteText = [n.title, n.body].filter(Boolean).join("\n\n");
      const items = await extractKnowledgeItemsFromText({
        title: n.title ?? null,
        text: noteText,
        hint: "project_note",
      });
      if (items.length > 0) {
        await storeStructuredProjectMemoryItems(projectId, "project_note_growth", n.id ?? null, items);
        extractedCount += items.length;
      }
    }

    // 2) Knowledge pages (project) → use title + summary as signal (safe, lightweight)
    const { data: spaces } = await supabaseAdmin
      .from("knowledge_spaces")
      .select("id")
      .eq("project_id", projectId)
      .limit(50);
    const spaceIds = (spaces ?? []).map((s) => (s as { id: string }).id).filter(Boolean);
    if (spaceIds.length > 0) {
      const { data: pages } = await supabaseAdmin
        .from("knowledge_pages")
        .select("id, title, summary, page_type, space_id, created_at")
        .in("space_id", spaceIds)
        .order("created_at", { ascending: false })
        .limit(limit);
      const rows = (pages ?? []) as Array<{ id: string; title: string | null; summary: string | null; page_type: string | null }>;
      for (const p of rows) {
        const text = [p.title, p.summary].filter(Boolean).join("\n\n");
        const items = await extractKnowledgeItemsFromText({
          title: p.title ?? null,
          text,
          hint: `knowledge_page:${p.page_type ?? "unknown"}`,
        });
        if (items.length > 0) {
          await storeStructuredProjectMemoryItems(projectId, "knowledge_page_growth", p.id, items);
          extractedCount += items.length;
        }
      }
    }

    // 3) Ticket resolutions (closed) → embedded memory + structured items
    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("id, title, description, solution_markdown, root_cause, resolution_type, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["closed", "resolved"])
      .order("created_at", { ascending: false })
      .limit(limit);
    const ticketRows = (tickets ?? []) as Array<{
      id: string;
      title: string | null;
      description: string | null;
      solution_markdown: string | null;
      root_cause: string | null;
      resolution_type: string | null;
    }>;
    for (const t of ticketRows) {
      const solutionText = (t.solution_markdown ?? t.description ?? "").trim();
      if (solutionText.length < 10) continue;

      // Existing embedded memory store (project_knowledge_memory)
      const record = extractKnowledgeFromTicket(t.title ?? "Issue resolved", t.description ?? null, t.solution_markdown ?? null);
      const embedded = await storeProjectMemory(projectId, userId ?? null, record, "ticket_closed");
      if (embedded?.id) embeddedCount++;

      // Structured extraction into project_memory
      const items = await extractKnowledgeItemsFromText({
        title: t.title ?? null,
        text: [t.title, t.root_cause ? `Root cause: ${t.root_cause}` : null, solutionText].filter(Boolean).join("\n\n"),
        hint: `ticket_resolution:${t.resolution_type ?? "unknown"}`,
      });
      if (items.length > 0) {
        await storeStructuredProjectMemoryItems(projectId, "ticket_resolution_growth", t.id, items);
        extractedCount += items.length;
      }
    }

    // 4) Connected documents already indexed into knowledge_documents → extract from small snippet per source
    const { data: docs } = await supabaseAdmin
      .from("knowledge_documents")
      .select("id, title, content, source, source_name, source_type, external_ref, created_at, chunk_index")
      .eq("project_id", projectId)
      .not("external_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit * 3);
    const docRows = (docs ?? []) as Array<{
      id: string;
      title: string | null;
      content: string;
      source: string | null;
      source_name: string | null;
      source_type: string | null;
      external_ref: string | null;
      chunk_index: number | null;
    }>;
    const bySource = new Map<string, { title: string | null; textParts: string[]; sourceType: string | null; externalRef: string | null }>();
    for (const d of docRows) {
      const key = (d.source ?? d.external_ref ?? d.id).toString();
      const entry = bySource.get(key) ?? { title: d.title ?? d.source_name ?? null, textParts: [], sourceType: d.source_type ?? null, externalRef: d.external_ref ?? null };
      if (entry.textParts.length < 2) entry.textParts.push((d.content ?? "").slice(0, 1800));
      bySource.set(key, entry);
    }
    for (const [key, v] of Array.from(bySource.entries()).slice(0, limit)) {
      const text = v.textParts.filter(Boolean).join("\n\n");
      const items = await extractKnowledgeItemsFromText({
        title: v.title ?? null,
        text,
        hint: `connected_document:${v.sourceType ?? "unknown"}`,
      });
      if (items.length > 0) {
        await storeStructuredProjectMemoryItems(projectId, "connected_document_growth", null, items);
        extractedCount += items.length;
      }
      // Also add a lightweight embedded memory artifact for retrieval readiness (doc_added).
      if (text.trim().length >= 120) {
        const embedded = await storeProjectMemory(
          projectId,
          userId ?? null,
          { title: v.title ?? null, problem: `Connected document: ${v.title ?? key}`, solution: text.slice(0, 6000), module: "general" },
          "document_added"
        );
        if (embedded?.id) embeddedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      projectId,
      scanned: {
        notes: notesResult.notes.length,
        knowledgeSpaces: spaceIds.length,
        tickets: ticketRows.length,
        connectedDocSources: bySource.size,
      },
      stored: {
        structuredItems: extractedCount,
        embeddedRecords: embeddedCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[knowledge-growth/run] error", err);
    return NextResponse.json({ error: "Knowledge growth run failed.", details: message }, { status: 500 });
  }
}

