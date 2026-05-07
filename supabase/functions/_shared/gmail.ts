const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

export async function refreshGmailAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to refresh Gmail token: ${data.error_description ?? data.error ?? "unknown error"}`);
  }
  return data.access_token as string;
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendViaGmail({
  refreshToken,
  fromEmail,
  toEmail,
  subject,
  html,
}: {
  refreshToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  html: string;
}): Promise<void> {
  const accessToken = await refreshGmailAccessToken(refreshToken);

  const rawEmail = [
    `From: ${fromEmail} <${fromEmail}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join("\r\n");

  const raw = base64urlEncode(rawEmail);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gmail send failed (${res.status}): ${err?.error?.message ?? JSON.stringify(err)}`);
  }
}

export function buildGoogleOAuthUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error_description ?? data.error ?? "unknown error"}`);
  }
  if (!data.refresh_token) {
    throw new Error("No refresh_token returned. Ensure prompt=consent and access_type=offline.");
  }

  let email = "";

  // Try to extract email from id_token
  if (data.id_token) {
    try {
      const parts = (data.id_token as string).split(".");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      email = payload.email ?? "";
    } catch {
      // fall through to userinfo
    }
  }

  // Fallback: fetch userinfo
  if (!email) {
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      email = info.email ?? "";
    }
  }

  if (!email) {
    throw new Error("Could not determine Gmail address from OAuth response");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email,
  };
}
