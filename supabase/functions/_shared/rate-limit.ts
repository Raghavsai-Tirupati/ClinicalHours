import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** OAuth: start Google consent (per Supabase user). */
export const GMAIL_OAUTH_INITIATE_MAX_PER_HOUR = 20;
/** OAuth: exchange code for tokens (per user). */
export const GMAIL_OAUTH_CALLBACK_MAX_PER_HOUR = 40;
/** Disconnect / revoke (per user). */
export const GMAIL_DISCONNECT_MAX_PER_HOUR = 40;

/** Gmail API sends per hospital_page per rolling hour (burst / abuse). */
export const GMAIL_SEND_PER_PAGE_PER_HOUR = 200;
/** Aligns with typical Gmail daily send caps (~500); rolling 24h window. */
export const GMAIL_SEND_PER_PAGE_PER_DAY = 450;

const WINDOW_HOUR = 3600;
const WINDOW_DAY = 86400;

export function rateLimitKeyOAuthInitiate(userId: string): string {
  return `gmail:oauth:init:${userId}`;
}
export function rateLimitKeyOAuthCallback(userId: string): string {
  return `gmail:oauth:cb:${userId}`;
}
export function rateLimitKeyDisconnect(userId: string): string {
  return `gmail:oauth:disc:${userId}`;
}
export interface ReserveRateLimitResult {
  allowed: boolean;
  count?: number;
  retryAfterSeconds?: number;
}

function retryAfterForWindow(windowSeconds: number): number {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds) * windowSeconds;
  const next = bucket + windowSeconds;
  return Math.max(1, next - now);
}

/**
 * Reserve capacity in a fixed window. Does not increment if it would exceed p_max.
 */
export async function reserveRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxPerWindow: number,
  windowSeconds: number,
  delta = 1,
): Promise<ReserveRateLimitResult> {
  const { data, error } = await supabase.rpc("reserve_edge_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: maxPerWindow,
    p_delta: delta,
  });

  if (error) {
    console.error("reserve_edge_rate_limit error:", error.message);
    return { allowed: false, retryAfterSeconds: retryAfterForWindow(windowSeconds) };
  }

  const row = data as { allowed?: boolean; count?: number } | null;
  const allowed = Boolean(row?.allowed);
  if (!allowed) {
    return {
      allowed: false,
      count: typeof row?.count === "number" ? row.count : undefined,
      retryAfterSeconds: retryAfterForWindow(windowSeconds),
    };
  }
  return { allowed: true, count: typeof row?.count === "number" ? row.count : undefined };
}

/** Convenience: OAuth single-step (delta=1). */
export async function reserveOAuthStep(
  supabase: SupabaseClient,
  key: string,
  maxPerHour: number,
): Promise<ReserveRateLimitResult> {
  return reserveRateLimit(supabase, key, maxPerHour, WINDOW_HOUR, 1);
}

/** Before sending N emails via Gmail for a hospital page (hour + day limits, one atomic transaction). */
export async function reserveGmailSendBatch(
  supabase: SupabaseClient,
  hospitalPageId: string,
  recipientCount: number,
): Promise<ReserveRateLimitResult> {
  if (recipientCount < 1) {
    return { allowed: true };
  }
  const { data, error } = await supabase.rpc("reserve_gmail_send_limits", {
    p_hospital_page_id: hospitalPageId,
    p_delta: recipientCount,
    p_max_hour: GMAIL_SEND_PER_PAGE_PER_HOUR,
    p_max_day: GMAIL_SEND_PER_PAGE_PER_DAY,
  });

  if (error) {
    console.error("reserve_gmail_send_limits error:", error.message);
    return { allowed: false, retryAfterSeconds: retryAfterForWindow(WINDOW_HOUR) };
  }

  const row = data as {
    allowed?: boolean;
    hour_count?: number;
    day_count?: number;
    blocked_by?: string;
  } | null;
  const allowed = Boolean(row?.allowed);
  if (!allowed) {
    const w = row?.blocked_by === "day" ? WINDOW_DAY : WINDOW_HOUR;
    return {
      allowed: false,
      count: typeof row?.hour_count === "number" ? row.hour_count : undefined,
      retryAfterSeconds: retryAfterForWindow(w),
    };
  }
  return { allowed: true };
}

export function jsonRateLimitResponse(
  corsHeaders: Record<string, string>,
  retryAfterSeconds?: number,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...corsHeaders,
  };
  if (retryAfterSeconds != null) {
    headers["Retry-After"] = String(Math.min(86400, Math.max(1, Math.ceil(retryAfterSeconds))));
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: "Rate limit exceeded. Try again later.",
      code: "rate_limited",
    }),
    { status: 429, headers },
  );
}
