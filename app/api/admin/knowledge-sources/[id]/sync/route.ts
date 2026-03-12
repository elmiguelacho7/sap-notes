/**
 * POST /api/admin/knowledge-sources/[id]/sync
 * Sync a knowledge source into knowledge_documents.
 * - Google Drive: folder/file content (PDF/DOCX).
 * - sap_help / official_web: single curated URL only (fetch → clean → chunk → embed). No crawling.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getDriveAccessToken,
  listFilesInFolder,
  getFileContentAsText,
  type DriveFileInfo,
} from "@/lib/integrations/googleDrive";
import { getEmbedding } from "@/lib/knowledge/ingestHelpers";
import { ingestCuratedSapPage, validateUrlForSourceType } from "@/lib/knowledge/curatedSapIngest";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Map curated SAP ingest error message to a short code for UI and persistence. */
function classifyCuratedSyncError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("javascript") ||
    m.includes("bot verification") ||
    m.includes("cannot be indexed by the current ingestion")
  ) return "js_required";
  if (
    m.includes("no readable content") ||
    m.includes("insufficient content") ||
    m.includes("no or insufficient content") ||
    m.includes("extracted text too short")
  ) return "no_content";
  if (m.includes("zero chunks") || m.includes("chunk generation produced zero")) return "zero_chunks";
  if (m.includes("embedding generation failed")) return "embed_failed";
  if (m.includes("insert chunk failed") || m.includes("failed to delete existing chunks")) return "insert_failed";
  return "other";
}

// ~600 tokens (500-800 range), ~4 chars per token
const CHUNK_SIZE_CHARS = 2400;

function chunkTextBySize(
  text: string,
  fileName: string,
  indexOffset: number
): { content: string; title: string; chunkIndex: number }[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks: { content: string; title: string; chunkIndex: number }[] = [];
  let start = 0;
  let index = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, normalized.length);
    let slice = normalized.slice(start, end);
    if (end < normalized.length) {
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > CHUNK_SIZE_CHARS / 2) {
        slice = slice.slice(0, lastSpace + 1);
        start += lastSpace + 1;
      } else {
        start = end;
      }
    } else {
      start = end;
    }
    if (slice.trim()) {
      chunks.push({
        content: slice.trim(),
        title: index === 0 ? fileName : `${fileName} (part ${index + 1})`,
        chunkIndex: indexOffset + index,
      });
      index++;
    }
  }
  return chunks;
}

/** Unique source_id per file to prevent duplicates and allow replace-by-source. */
function sourceIdentifier(fileId: string): string {
  return `google_drive:${fileId}`;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    console.log("[admin/knowledge-sources/sync] route hit");
    const auth = await requireAuthAndGlobalPermission(request, "manage_knowledge_sources");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { id: sourceId } = await params;
    if (!sourceId?.trim()) {
      return NextResponse.json(
        { error: "ID de fuente requerido." },
        { status: 400 }
      );
    }

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id, scope_type, project_id, source_type, source_name, external_ref, source_url, integration_id")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      console.error("[admin/knowledge-sources/sync] source fetch error", sourceError?.message);
      return NextResponse.json(
        { error: "Fuente no encontrada." },
        { status: 404 }
      );
    }

    const row = source as {
      scope_type: string;
      project_id: string | null;
      source_type: string;
      source_name: string;
      external_ref: string | null;
      source_url: string | null;
      integration_id: string | null;
    };

    if (row.scope_type !== "global" && row.scope_type !== "project") {
      return NextResponse.json(
        { error: "Fuente con scope no soportado para sincronización." },
        { status: 400 }
      );
    }
    if (row.scope_type === "project" && !row.project_id?.trim()) {
      return NextResponse.json(
        { error: "Fuente de proyecto sin project_id." },
        { status: 400 }
      );
    }

    // Curated official SAP (single URL only; no crawling).
    if (row.source_type === "sap_help" || row.source_type === "official_web" || row.source_type === "sap_official") {
      if (row.scope_type !== "global") {
        return NextResponse.json(
          { error: "Fuentes SAP oficiales deben ser globales (scope_type = global)." },
          { status: 400 }
        );
      }
      const url = (row.source_url ?? "").trim();
      if (!url) {
        return NextResponse.json(
          { error: "Falta source_url en la fuente. Añade la URL de la página SAP a indexar." },
          { status: 400 }
        );
      }
      const validation = validateUrlForSourceType(url, row.source_type);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.error ?? "La URL no es válida para este tipo de fuente." },
          { status: 400 }
        );
      }
      try {
        const documentType = (row.source_type === "official_web" || row.source_type === "sap_official") ? "sap_official" : "sap_help";
        const { chunksInserted } = await ingestCuratedSapPage({
          url,
          title: row.source_name || "SAP Documentation",
          module: "general",
          topic: "curated",
          document_type: documentType,
          source_name: row.source_name || "SAP Help",
        });
        const finishedAt = new Date().toISOString();
        await supabaseAdmin
          .from("knowledge_sources")
          .update({
            last_synced_at: finishedAt,
            updated_at: finishedAt,
            status: "active",
            last_sync_error: null,
            last_sync_status_detail: null,
          })
          .eq("id", sourceId);
        console.log("[admin/knowledge-sources/sync] curated SAP done", { sourceId: sourceId.slice(0, 8), chunksInserted });
        return NextResponse.json({
          ok: true,
          documentsProcessed: 1,
          chunksCreated: chunksInserted,
          errors: [],
          status: "synced",
          last_sync_at: finishedAt,
          message: `Página indexada. ${chunksInserted} fragmentos.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[admin/knowledge-sources/sync] curated SAP ingest error", msg);
        const detailCode = classifyCuratedSyncError(msg);
        const finishedAt = new Date().toISOString();
        await supabaseAdmin
          .from("knowledge_sources")
          .update({
            last_synced_at: finishedAt,
            updated_at: finishedAt,
            status: "error",
            last_sync_error: msg.slice(0, 500),
            last_sync_status_detail: detailCode,
          })
          .eq("id", sourceId);
        return NextResponse.json({
          ok: false,
          documentsProcessed: 0,
          chunksCreated: 0,
          errors: [msg],
          status: "error",
          last_sync_at: finishedAt,
          sync_status_detail: detailCode,
          message: `Error al indexar: ${msg}`,
        }, { status: 500 });
      }
    }

    if (row.source_type !== "google_drive_folder" && row.source_type !== "google_drive_file") {
      return NextResponse.json(
        { error: "Esta fuente no es de Google Drive ni SAP oficial. Solo se puede sincronizar Drive o fuentes sap_help / sap_official / official_web." },
        { status: 400 }
      );
    }
    if (!row.integration_id?.trim() || !row.external_ref?.trim()) {
      return NextResponse.json(
        { error: "Falta la cuenta de Drive vinculada o el ID de carpeta/archivo." },
        { status: 400 }
      );
    }

    const folderId = row.external_ref;
    const projectIdForDocs: string | null = row.scope_type === "project" ? row.project_id : null;
    console.log("[admin/knowledge-sources/sync] sync started", { sourceId: sourceId.slice(0, 8), scope: row.scope_type, folderId: folderId?.slice(0, 8) });

    let accessToken: string;
    try {
      accessToken = await getDriveAccessToken(row.integration_id, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al obtener token";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const allFiles: DriveFileInfo[] = [];
    let pageToken: string | null = null;
    do {
      const { files, nextPageToken } = await listFilesInFolder(accessToken, folderId, pageToken);
      allFiles.push(...files);
      pageToken = nextPageToken;
    } while (pageToken);

    const supportedFiles = allFiles.filter((f) => SUPPORTED_MIME_TYPES.has(f.mimeType));
    console.log("[admin/knowledge-sources/sync] files found", { total: allFiles.length, supported: supportedFiles.length });

    let filesProcessed = 0;
    let chunksCreated = 0;
    const errors: string[] = [];

    for (const file of supportedFiles) {
      try {
        const text = await getFileContentAsText(accessToken, file.id, file.mimeType);
        if (!text || text.length === 0) {
          continue;
        }

        const sid = sourceIdentifier(file.id);
        const chunks = chunkTextBySize(text, file.name, 0);
        if (chunks.length === 0) continue;

        const deleteBuilder = supabaseAdmin
          .from("knowledge_documents")
          .delete()
          .eq("source", sid);
        const { error: delError } = projectIdForDocs == null
          ? await deleteBuilder.is("project_id", null)
          : await deleteBuilder.eq("project_id", projectIdForDocs);

        if (delError) {
          console.error("[admin/knowledge-sources/sync] delete old chunks failed", sid, delError.message);
          errors.push(`No se pudieron reemplazar chunks de ${file.name}`);
          continue;
        }

        for (const ch of chunks) {
          try {
            const embedding = await getEmbedding(ch.content);
            const { error: insError } = await supabaseAdmin.from("knowledge_documents").insert({
              project_id: projectIdForDocs,
              title: ch.title,
              content: ch.content,
              source: sid,
              module: file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "general",
              source_type: "google_drive",
              source_name: file.name,
              external_ref: file.id,
              chunk_index: ch.chunkIndex,
              embedding,
            });
            if (insError) throw insError;
            chunksCreated++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[admin/knowledge-sources/sync] chunk insert failed", ch.title?.slice(0, 40), msg);
            errors.push(msg);
          }
        }
        filesProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[admin/knowledge-sources/sync] file extraction failed", file.name, msg);
        errors.push(`Error en ${file.name}: ${msg}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const syncStatus = errors.length === 0 ? "synced" : "error";
    await supabaseAdmin
      .from("knowledge_sources")
      .update({
        last_synced_at: finishedAt,
        updated_at: finishedAt,
        status: syncStatus === "synced" ? "active" : "error",
      })
      .eq("id", sourceId);

    console.log("[admin/knowledge-sources/sync] done", {
      sourceId: sourceId.slice(0, 8),
      documentsProcessed: filesProcessed,
      chunksCreated,
      syncStatus,
    });

    return NextResponse.json({
      ok: errors.length === 0,
      documentsProcessed: filesProcessed,
      filesFound: supportedFiles.length,
      filesProcessed: filesProcessed,
      chunksCreated,
      errors: errors,
      errorSummary: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      status: syncStatus,
      last_sync_at: finishedAt,
      message:
        errors.length === 0
          ? `Sync completed. ${filesProcessed} documents, ${chunksCreated} chunks.`
          : `Sync finished with errors. ${filesProcessed} documents, ${chunksCreated} chunks. ${errors.length} error(s).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/knowledge-sources/sync] error", message);
    return NextResponse.json(
      { error: "No se pudo sincronizar la fuente global.", details: message },
      { status: 500 }
    );
  }
}
