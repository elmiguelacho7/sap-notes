import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "knowledge-assets";

// 10MB max keeps uploads responsive and avoids accidental large binary blobs.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

function sanitizeExt(maybeExt: string | null | undefined): string | null {
  const raw = (maybeExt ?? "").trim().toLowerCase();
  if (!raw) return null;
  const clean = raw.replace(/[^a-z0-9]/g, "");
  return clean || null;
}

function getFileExtensionFromMime(mime: string | undefined | null): string | null {
  const m = (mime ?? "").toLowerCase();
  if (!m) return null;
  if (!ALLOWED_MIME_TYPES.has(m)) return null;
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return null;
}

function getFileExtensionFromName(fileName: string): string | null {
  const parts = String(fileName || "").split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  const sanitized = sanitizeExt(ext);
  if (!sanitized) return null;
  return ALLOWED_EXTENSIONS.has(sanitized) ? (sanitized === "jpeg" ? "jpg" : sanitized) : null;
}

function isAllowedMimeOrInferExt(mime: string | null | undefined, fileName: string): { mime: string | null; ext: string } {
  const mimeExt = getFileExtensionFromMime(mime);
  if (mimeExt) {
    const contentType = mime === "image/jpg" ? "image/jpeg" : mime; // normalize if needed
    return { mime: contentType ?? null, ext: mimeExt };
  }

  // If MIME is missing (can happen in some browsers), infer from the extension.
  const inferredExt = getFileExtensionFromName(fileName);
  if (inferredExt) return { mime: null, ext: inferredExt };

  throw new Error("Solo se permiten imágenes (PNG, JPG/JPEG, WEBP, GIF).");
}

export async function uploadKnowledgeImage({
  supabase,
  file,
  pageId,
  projectId,
}: {
  supabase: SupabaseClient;
  file: File;
  pageId: string;
  projectId?: string | null;
}): Promise<string> {
  if (!file) throw new Error("No image file provided.");
  if (!pageId) throw new Error("Missing pageId for image upload path.");

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round((MAX_FILE_SIZE_BYTES / (1024 * 1024)) * 10) / 10;
    throw new Error(`La imagen supera el tamaño máximo (${maxMb} MB).`);
  }

  // Bucket must exist (ideally created via migration / Supabase SQL).
  // We treat missing bucket as a hard error so we don't silently lose images.
  const { mime: contentTypeMaybe, ext } = isAllowedMimeOrInferExt(file.type, file.name);
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const projectPart = projectId ? String(projectId) : "global";
  const safePageId = String(pageId).replaceAll("/", "_");
  const storagePath = `${projectPart}/${safePageId}/${uuid}.${ext}`;

  const contentType = contentTypeMaybe ?? `image/${ext}`;

  const uploadRes = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType,
    // We always generate unique filenames, so upsert isn't needed.
    upsert: false,
  });

  if (uploadRes.error) {
    throw new Error(uploadRes.error.message ?? "Error al subir la imagen.");
  }

  const publicUrlRes = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicUrlRes.data.publicUrl;
  if (!publicUrl) {
    throw new Error("No se pudo generar la URL pública para la imagen.");
  }

  return publicUrl;
}

