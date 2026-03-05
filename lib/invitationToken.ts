import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

/**
 * Generate a secure random token (raw string to put in the invite link)
 * and its SHA-256 hash for storage. Do not store the raw token.
 */
export function generateInvitationToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("hex");
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * Hash a token with SHA-256 for comparison with stored token_hash.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}
