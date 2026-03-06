/**
 * Server-side Google Drive API client for project source sync.
 * Uses stored integration tokens; refreshes if needed. No tokens exposed to client.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export type DriveFileInfo = {
  id: string;
  name: string;
  mimeType: string;
};

export type IntegrationTokens = {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
};

/**
 * Load integration, ensure it belongs to the user, and return a valid access token (refreshing if needed).
 * Throws if integration not found, not owned by user, or token refresh fails.
 */
export async function getDriveAccessToken(
  integrationId: string,
  userId: string
): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from("external_integrations")
    .select("id, access_token, refresh_token, token_expires_at, owner_profile_id")
    .eq("id", integrationId)
    .single();

  if (error || !row) {
    console.error("[googleDrive] Integration not found", integrationId, error?.message);
    throw new Error("Cuenta de Google Drive no encontrada o no tienes acceso");
  }

  const ownerId = (row as { owner_profile_id: string }).owner_profile_id;
  if (ownerId !== userId) {
    throw new Error("Esta cuenta de Google Drive no te pertenece");
  }

  const tokens: IntegrationTokens = {
    access_token: (row as { access_token: string }).access_token ?? "",
    refresh_token: (row as { refresh_token: string | null }).refresh_token ?? null,
    token_expires_at: (row as { token_expires_at: string | null }).token_expires_at ?? null,
  };

  return ensureValidAccessToken(tokens, async (newAccessToken, expiresAt) => {
    await supabaseAdmin
      .from("external_integrations")
      .update({
        access_token: newAccessToken,
        token_expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId);
  });
}

/**
 * Build a valid access token, refreshing if necessary.
 * Updates the integration in DB if refresh was performed (caller must pass supabase and integrationId for that).
 */
export async function ensureValidAccessToken(
  tokens: IntegrationTokens,
  refresh: (newAccessToken: string, expiresAt: string) => Promise<void>
): Promise<string> {
  const expiresAt = tokens.token_expires_at ? new Date(tokens.token_expires_at).getTime() : 0;
  const now = Date.now();
  const bufferSeconds = 60;
  if (expiresAt > now + bufferSeconds * 1000 && tokens.access_token) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token?.trim()) {
    throw new Error("Google Drive token expired and no refresh token available");
  }
  const { refreshAccessToken } = await import("@/lib/integrations/googleAuth");
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const newExpires = new Date();
  newExpires.setSeconds(newExpires.getSeconds() + refreshed.expires_in);
  await refresh(refreshed.access_token, newExpires.toISOString());
  return refreshed.access_token;
}

/**
 * List files (and folders) in a Drive folder. Does not recurse. Supports pagination.
 */
export async function listFilesInFolder(
  accessToken: string,
  folderId: string,
  pageToken?: string | null
): Promise<{ files: DriveFileInfo[]; nextPageToken: string | null }> {
  const q = `'${folderId}' in parents and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: "nextPageToken,files(id,name,mimeType)",
    pageSize: "100",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const url = `${DRIVE_API_BASE}/files?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[googleDrive] listFilesInFolder failed", res.status, text.slice(0, 300));
    throw new Error(`Google Drive list failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    files?: { id: string; name: string; mimeType: string }[];
    nextPageToken?: string;
  };
  const files = (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType || "application/octet-stream",
  }));
  return {
    files,
    nextPageToken: data.nextPageToken ?? null,
  };
}

/**
 * Get metadata for a single file (e.g. to check mimeType for a file by id).
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<{ id: string; name: string; mimeType: string }> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[googleDrive] getFileMetadata failed", res.status, text.slice(0, 300));
    throw new Error(`Google Drive get file failed: ${res.status}`);
  }
  const f = (await res.json()) as { id: string; name: string; mimeType: string };
  return { id: f.id, name: f.name, mimeType: f.mimeType || "application/octet-stream" };
}

/** MIME types we can extract text from in this sprint. */
export const SUPPORTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/vnd.google-apps.document", // Google Docs -> export to text/plain
]);

/**
 * Fetch or export file content as UTF-8 text. Supports text/plain, text/markdown, Google Docs.
 * For unsupported types returns null (caller should skip or record as skipped).
 */
export async function getFileContentAsText(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string | null> {
  const normalized = mimeType?.toLowerCase().trim() || "";
  if (normalized === "application/vnd.google-apps.document") {
    const exportUrl = `${DRIVE_API_BASE}/files/${fileId}/export?mimeType=text/plain`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[googleDrive] Docs export failed", fileId, res.status);
      return null;
    }
    const blob = await res.blob();
    const text = await blob.text();
    return text?.trim() || null;
  }
  if (
    normalized === "text/plain" ||
    normalized === "text/markdown" ||
    normalized === "text/x-markdown"
  ) {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[googleDrive] File download failed", fileId, res.status);
      return null;
    }
    const text = await res.text();
    return text?.trim() || null;
  }
  return null;
}
