/**
 * POST /api/integrations/google/sync
 * Syncs documents from the project's configured Google Drive folder into knowledge_documents.
 * Reads config from knowledge_sources (project-scoped) first, then project_sources for compatibility.
 * Supports PDF and DOCX only. Never exposes data across projects.
 * Chunks are stored with project_id so retrieval is project-scoped; global knowledge uses project_id IS NULL.
 */

import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getDriveAccessToken,
  listFilesInFolder,
  getFileContentAsText,
  type DriveFileInfo,
} from "@/lib/integrations/googleDrive";
import { getEmbedding } from "@/lib/knowledge/ingestHelpers";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const CHUNK_SIZE_CHARS = 1200;

function chunkTextBySize(
  text: string,
  fileName: string,
  sourceId: string,
  projectId: string
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
        chunkIndex: index,
      });
      index++;
    }
  }
  return chunks;
}

function sourceIdentifier(fileId: string): string {
  return `google_drive:${fileId}`;
}

/** Resolve Drive folder config: knowledge_sources first, then project_sources for compatibility. */
async function getProjectDriveSource(projectId: string): Promise<{
  id: string;
  integration_id: string;
  external_ref: string;
  name: string;
} | null> {
  const { data: ksRow } = await supabaseAdmin
    .from("knowledge_sources")
    .select("id, integration_id, external_ref, source_name")
    .eq("scope_type", "project")
    .eq("project_id", projectId)
    .eq("source_type", "google_drive_folder")
    .not("integration_id", "is", null)
    .not("external_ref", "is", null)
    .limit(1)
    .maybeSingle();

  if (ksRow) {
    return {
      id: (ksRow as { id: string }).id,
      integration_id: (ksRow as { integration_id: string }).integration_id,
      external_ref: (ksRow as { external_ref: string }).external_ref,
      name: (ksRow as { source_name: string }).source_name,
    };
  }

  const { data: psRow } = await supabaseAdmin
    .from("project_sources")
    .select("id, integration_id, external_id, name")
    .eq("project_id", projectId)
    .eq("source_type", "google_drive_folder")
    .not("integration_id", "is", null)
    .not("external_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (psRow) {
    return {
      id: (psRow as { id: string }).id,
      integration_id: (psRow as { integration_id: string }).integration_id,
      external_ref: (psRow as { external_id: string }).external_id,
      name: (psRow as { name: string }).name,
    };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    let body: { projectId?: string };
    try {
      body = (await req.json()) as { projectId?: string };
    } catch {
      return NextResponse.json(
        { error: "Cuerpo inválido. Envía { projectId }." },
        { status: 400 }
      );
    }

    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "manage_project_knowledge");
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const source = await getProjectDriveSource(projectId);
    if (!source) {
      return NextResponse.json(
        { error: "No hay ninguna carpeta de Google Drive configurada para este proyecto." },
        { status: 400 }
      );
    }

    const folderId = source.external_ref;

    console.log("[integrations/google/sync] sync started", { projectId, folderId: folderId?.slice(0, 8) });

    let accessToken: string;
    try {
      accessToken = await getDriveAccessToken(source.integration_id, userId);
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
    console.log("[integrations/google/sync] files found", { total: allFiles.length, supported: supportedFiles.length });

    let filesProcessed = 0;
    let chunksCreated = 0;
    const errors: string[] = [];

    for (const file of supportedFiles) {
      const text = await getFileContentAsText(accessToken, file.id, file.mimeType);
      if (!text || text.length === 0) {
        continue;
      }

      const sourceId = sourceIdentifier(file.id);
      const chunks = chunkTextBySize(text, file.name, sourceId, projectId);
      if (chunks.length === 0) continue;

      const { error: delError } = await supabaseAdmin
        .from("knowledge_documents")
        .delete()
        .eq("source", sourceId);

      if (delError) {
        console.error("[integrations/google/sync] delete old chunks failed", sourceId, delError.message);
        errors.push(`No se pudieron reemplazar chunks de ${file.name}`);
        continue;
      }

      for (const ch of chunks) {
        try {
          const embedding = await getEmbedding(ch.content);
          const { error: insError } = await supabaseAdmin.from("knowledge_documents").insert({
            project_id: projectId,
            title: ch.title,
            content: ch.content,
            source: sourceId,
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
          console.error("[integrations/google/sync] chunk insert failed", ch.title?.slice(0, 40), msg);
          errors.push(msg);
        }
      }
      filesProcessed++;
    }

    console.log("[integrations/google/sync] documents stored", { filesProcessed, chunksCreated });

    return NextResponse.json({
      ok: errors.length === 0,
      filesFound: supportedFiles.length,
      filesProcessed,
      chunksCreated,
      message:
        errors.length > 0
          ? `Sincronización completada con errores: ${errors.slice(0, 2).join("; ")}`
          : "Sync completed",
      errorSummary: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[integrations/google/sync]", err);
    return NextResponse.json(
      { error: "No se pudo sincronizar Google Drive.", details: message },
      { status: 500 }
    );
  }
}
