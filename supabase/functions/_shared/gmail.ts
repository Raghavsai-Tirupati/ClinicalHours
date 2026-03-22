/**
 * Gmail API helpers used by email-sending edge functions.
 * Credentials are read from environment variables and never leave the edge runtime.
 */

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

/** Exchange a refresh token for a short-lived access token. */
export async function refreshGmailAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(
      `Gmail token refresh failed: ${err.error_description ?? err.error ?? res.statusText}`,
    );
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

/**
 * Send an email via the Gmail REST API on behalf of the connected account.
 *
 * @param refreshToken  The stored OAuth refresh token for this clinic admin.
 * @param fromEmail     The sender address (must match the authorised Gmail account).
 * @param toEmail       Recipient address.
 * @param subject       Email subject.
 * @param html          HTML email body.
 */
export async function sendViaGmail(params: {
  refreshToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  html: string;
}): Promise<void> {
  const accessToken = await refreshGmailAccessToken(params.refreshToken);

  // Build a minimal RFC 2822 message.
  // Subject may contain non-ASCII characters; encode with RFC 2047 Q-encoding.
  const encodedSubject = encodeRfc2047(params.subject);
  const raw = [
    `From: ${params.fromEmail}`,
    `To: ${params.toEmail}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    params.html,
  ].join("\r\n");

  // Gmail API expects base64url-encoded raw message.
  const encoded = base64url(raw);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(
      `Gmail send failed (${res.status}): ${err.error?.message ?? res.statusText}`,
    );
  }
}

/** RFC 2047 Q-encoding for non-ASCII Subject headers. */
function encodeRfc2047(text: string): string {
  // If entirely ASCII, return as-is.
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  const encoded = btoa(
    String.fromCharCode(...new TextEncoder().encode(text)),
  );
  return `=?UTF-8?B?${encoded}?=`;
}

/** Base64url encode a string (no padding). */
function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build the Google OAuth 2.0 authorisation URL. */
export function buildGoogleOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send email profile",
    access_type: "offline",
    prompt: "consent",  // force consent so we always get a refresh token
    state: params.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

/** Exchange an authorisation code for access + refresh tokens. */
export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(
      `OAuth code exchange failed: ${err.error_description ?? err.error ?? res.statusText}`,
    );
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
  };

  if (!data.refresh_token) {
    throw new Error(
      "No refresh token returned. The user may have already granted access — try disconnecting and reconnecting.",
    );
  }

  // Decode the id_token to get the Gmail address (it's a JWT; we only need the payload).
  const email = extractEmailFromIdToken(data.id_token) ?? await fetchEmailFromUserinfo(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email,
  };
}

function extractEmailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function fetchEmailFromUserinfo(accessToken: string): Promise<string> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Could not fetch Google user info");
  const data = await res.json() as { email?: string };
  if (!data.email) throw new Error("Google user info did not include an email address");
  return data.email;
}
