/**
 * Google OAuth config and token exchange for Drive integration.
 * Server-side only. No secrets in client.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "email",
  "profile",
].join(" ");

export type GoogleEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Returns Google OAuth env vars. Fails with explicit error if missing (server-side only).
 */
export function getGoogleOAuthEnv(): GoogleEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId) {
    console.error("[googleAuth] Missing GOOGLE_CLIENT_ID");
    throw new Error("Google OAuth not configured: GOOGLE_CLIENT_ID is required");
  }
  if (!clientSecret) {
    console.error("[googleAuth] Missing GOOGLE_CLIENT_SECRET");
    throw new Error("Google OAuth not configured: GOOGLE_CLIENT_SECRET is required");
  }
  if (!redirectUri) {
    console.error("[googleAuth] Missing GOOGLE_REDIRECT_URI");
    throw new Error("Google OAuth not configured: GOOGLE_REDIRECT_URI is required");
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Returns true if Google OAuth env is set (for feature gating).
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

/**
 * Build the Google OAuth authorization URL for the connect flow.
 */
export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export type GoogleUserInfo = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[googleAuth] Token exchange failed", res.status, text);
    throw new Error("Google OAuth token exchange failed");
  }

  const data = (await res.json()) as GoogleTokenResponse;
  if (!data.access_token) {
    console.error("[googleAuth] No access_token in response");
    throw new Error("Google OAuth: no access token in response");
  }
  return data;
}

/**
 * Fetch user info using access token. Do not log the token.
 */
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error("[googleAuth] UserInfo failed", res.status);
    throw new Error("Google userinfo request failed");
  }

  return (await res.json()) as GoogleUserInfo;
}

/**
 * Compute token_expires_at from expires_in (seconds).
 */
export function tokenExpiresAt(expiresInSeconds: number): Date {
  const d = new Date();
  d.setSeconds(d.getSeconds() + expiresInSeconds);
  return d;
}

/**
 * Refresh access token using refresh_token. Returns new access_token and expires_in (seconds).
 * Use when token_expires_at is in the past or near future.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const { clientId, clientSecret } = getGoogleOAuthEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[googleAuth] Token refresh failed", res.status, text.slice(0, 200));
    throw new Error("Google OAuth token refresh failed");
  }

  const data = (await res.json()) as GoogleTokenResponse;
  if (!data.access_token) {
    console.error("[googleAuth] No access_token in refresh response");
    throw new Error("Google OAuth: no access token in refresh response");
  }
  return {
    access_token: data.access_token,
    expires_in: typeof data.expires_in === "number" ? data.expires_in : 3600,
  };
}
