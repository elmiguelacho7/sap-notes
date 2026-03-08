import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest, isProjectMember } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getDriveAccessToken,
  listFilesInFolder,
  getFileMetadata,
  getFileContentAsText,
  SUPPORTED_MIME_TYPES,
  type DriveFileInfo,
} from "@/lib/integrations/googleDrive";
import {
  chunkText,
  getEmbedding,
  moduleFromFileName,
} from "@/lib/knowledge/ingestHelpers";
import {
  extractKnowledgeFromDocument,
  storeProjectMemory,
} from "@/lib/ai/projectMemory";

type RouteParams = { params: Promise<{ id: string; sourceId: string }> };

type ProjectSourceRow = {
  id: string;
  project_id: string;
  source_type: string;
  name: string;
  integration_id: string | null;
  external_id: string | null;
};

const GOOGLE_DRIVE_SOURCE_TYPES = ["google_drive_folder", "google_drive_file"] as const;

function sourceIdentifier(fileId: string): string {
  return `google_drive:${fileId}`;
}

async function processOneFile(
  accessToken: string,
  fileInfo: DriveFileInfo,
  projectId: string,
  projectSourceName: string,
  sourceType: "google_drive_folder" | "google_drive_file",
  userId: string | null
): Promise<{ processed: number; skipped: boolean; error: string | null }> {
  const fileId = fileInfo.id;
  const mimeType = fileInfo.mimeType;
  const name = fileInfo.name;

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return { processed: 0, skipped: true, error: null };
  }

  const text = await getFileContentAsText(accessToken, fileId, mimeType);
  if (!text || text.length === 0) {
    return { processed: 0, skipped: true, error: null };
  }

  const source = sourceIdentifier(fileId);
  const title = name;
  const moduleLabel = moduleFromFileName(name);
  const chunks = chunkText(text, source, title, moduleLabel);
  if (chunks.length === 0) {
    return { processed: 0, skipped: false, error: null };
  }

  const { error: delError } = await supabaseAdmin
    .from("knowledge_documents")
    .delete()
    .eq("source", source);

  if (delError) {
    console.error("[sync] Delete old chunks failed", source, delError);
    return { processed: 0, skipped: false, error: "No se pudieron reemplazar documentos previos" };
  }

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    try {
      const embedding = await getEmbedding(ch.content);
      const { error: insError } = await supabaseAdmin.from("knowledge_documents").insert({
        title: ch.title,
        content: ch.content,
        source: ch.source,
        module: ch.module,
        embedding,
        project_id: projectId,
        source_type: sourceType,
        source_name: projectSourceName || name,
        external_ref: fileId,
        chunk_index: i,
        mime_type: mimeType,
      });
      if (insError) throw insError;
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Embedding/insert failed";
      console.error("[sync] Chunk insert failed", ch.title?.slice(0, 40), msg);
      return { processed: inserted, skipped: false, error: msg };
    }
  }
  const record = extractKnowledgeFromDocument(title, text, moduleLabel);
  if (record.solution.trim()) {
    storeProjectMemory(projectId, userId, record, "document_added").catch((err) =>
      console.error("[sync] project memory store failed", err)
    );
  }
  return { processed: inserted, skipped: false, error: null };
}

export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, sourceId } = await params;

    if (!projectId?.trim() || !sourceId?.trim()) {
      return NextResponse.json(
        { error: "Project ID and source ID are required" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserIdFromRequest(_req);
    if (!userId) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para sincronizar" },
        { status: 401 }
      );
    }

    const isMember = await isProjectMember(userId, projectId);
    if (!isMember) {
      return NextResponse.json(
        { error: "No tienes acceso a este proyecto" },
        { status: 403 }
      );
    }

    const { data: sourceRow, error: sourceError } = await supabaseAdmin
      .from("project_sources")
      .select("id, project_id, source_type, name, integration_id, external_id")
      .eq("project_id", projectId)
      .eq("id", sourceId)
      .single();

    if (sourceError || !sourceRow) {
      return NextResponse.json(
        { error: "Fuente no encontrada" },
        { status: 404 }
      );
    }

    const source = sourceRow as ProjectSourceRow;
    if (!GOOGLE_DRIVE_SOURCE_TYPES.includes(source.source_type as (typeof GOOGLE_DRIVE_SOURCE_TYPES)[number])) {
      return NextResponse.json(
        { error: "Esta fuente no es de Google Drive; la sincronización manual solo está disponible para Drive." },
        { status: 400 }
      );
    }

    if (!source.integration_id?.trim()) {
      return NextResponse.json(
        { error: "Esta fuente no tiene una cuenta de Google Drive vinculada." },
        { status: 400 }
      );
    }
    if (!source.external_id?.trim()) {
      return NextResponse.json(
        { error: "Falta el ID de carpeta o archivo en Drive. Edita la fuente e indica el ID." },
        { status: 400 }
      );
    }

    let accessToken: string;
    try {
      accessToken = await getDriveAccessToken(source.integration_id, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al obtener el token";
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    const { data: jobRow, error: jobInsertError } = await supabaseAdmin
      .from("project_source_sync_jobs")
      .insert({
        project_source_id: sourceId,
        trigger_type: "manual",
        status: "running",
        initiated_by: userId,
      })
      .select("id")
      .single();

    if (jobInsertError || !jobRow) {
      console.error("[sync] Failed to create sync job", jobInsertError);
      return NextResponse.json(
        { error: "No se pudo iniciar el trabajo de sincronización" },
        { status: 500 }
      );
    }

    const jobId = (jobRow as { id: string }).id;
    let filesSeen = 0;
    let filesProcessed = 0;
    let filesSkipped = 0;
    let filesFailed = 0;
    const errorMessages: string[] = [];

    try {
      if (source.source_type === "google_drive_folder") {
        let pageToken: string | null = null;
        do {
          const { files, nextPageToken } = await listFilesInFolder(
            accessToken,
            source.external_id!,
            pageToken ?? undefined
          );
          for (const file of files) {
            filesSeen++;
            const result = await processOneFile(
              accessToken,
              file,
              source.project_id,
              source.name,
              source.source_type as "google_drive_folder" | "google_drive_file",
              userId
            );
            if (result.error) {
              filesFailed++;
              if (result.error && !errorMessages.includes(result.error)) {
                errorMessages.push(result.error);
              }
            } else if (result.skipped) {
              filesSkipped++;
            } else {
              filesProcessed++;
            }
          }
          pageToken = nextPageToken;
        } while (pageToken);
      } else {
        const meta = await getFileMetadata(accessToken, source.external_id!);
        filesSeen = 1;
        const result = await processOneFile(
          accessToken,
          { id: meta.id, name: meta.name, mimeType: meta.mimeType },
          source.project_id,
          source.name,
          source.source_type as "google_drive_folder" | "google_drive_file",
          userId
        );
        if (result.error) {
          filesFailed = 1;
          errorMessages.push(result.error);
        } else if (result.skipped) {
          filesSkipped = 1;
        } else {
          filesProcessed = 1;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sync] Drive read/process error", err);
      errorMessages.push(msg);
      if (filesSeen === 0) filesFailed = 1;
    }

    const errorSummary =
      errorMessages.length > 0 ? errorMessages.slice(0, 3).join("; ") : null;
    const finishedAt = new Date().toISOString();
    let jobStatus: "success" | "partial" | "error" = "success";
    if (filesFailed > 0 || (filesSeen > 0 && filesProcessed === 0 && filesSkipped + filesFailed >= filesSeen)) {
      jobStatus = filesProcessed > 0 ? "partial" : "error";
    } else if (filesSkipped > 0 && filesProcessed > 0) {
      jobStatus = "partial";
    }

    await supabaseAdmin
      .from("project_source_sync_jobs")
      .update({
        status: jobStatus,
        finished_at: finishedAt,
        files_seen: filesSeen,
        files_processed: filesProcessed,
        files_skipped: filesSkipped,
        files_failed: filesFailed,
        error_summary: errorSummary,
      })
      .eq("id", jobId);

    const sourceStatus = jobStatus;
    await supabaseAdmin
      .from("project_sources")
      .update({
        last_synced_at: finishedAt,
        last_sync_status: sourceStatus,
        updated_at: finishedAt,
      })
      .eq("id", sourceId);

    return NextResponse.json({
      ok: jobStatus === "success",
      jobId,
      status: jobStatus,
      files_seen: filesSeen,
      files_processed: filesProcessed,
      files_skipped: filesSkipped,
      files_failed: filesFailed,
      error_summary: errorSummary,
      last_synced_at: finishedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync] POST error", err);
    return NextResponse.json(
      { error: "No se pudo sincronizar esta fuente", details: message },
      { status: 500 }
    );
  }
}
