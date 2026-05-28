import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Valid event types
const VALID_EVENT_TYPES = [
  "page_view",
  "button_click",
  "guest_conversion",
  "signup",
  "login",
  "opportunity_viewed",
  "opportunity_search",
  "opportunity_saved",
  "opportunity_unsaved",
  "apply_link_clicked",
  "profile_incomplete_bounce",
];

// Rate limiting: max events per session per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EVENTS_PER_WINDOW = 60; // 60 events per minute per session

// In-memory rate limit cache (resets on cold start, which is acceptable for edge functions)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

interface TrackingEvent {
  session_id: string;
  event_type: string;
  page_url: string;
  referrer_url?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
  timezone?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeString(str: string | undefined, maxLength: number): string | undefined {
  if (!str) return undefined;
  // Remove any null bytes and trim
  return str.replace(/\0/g, "").trim().slice(0, maxLength);
}

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(sessionId);

  if (!entry || now > entry.resetTime) {
    // New window or window expired
    rateLimitCache.set(sessionId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old rate limit entries periodically
function cleanupRateLimitCache() {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache) {
    if (now > entry.resetTime) {
      rateLimitCache.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Validate Origin (allow tracking from allowed origins only)
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed for tracking: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Parse request body - handle both JSON and text/plain (from sendBeacon)
    let payload: TrackingEvent;
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await req.json();
      } else {
        // Handle blob/text requests (e.g., from sendBeacon)
        const text = await req.text();
        payload = JSON.parse(text);
      }
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate required fields
    if (!payload.session_id || !isValidUUID(payload.session_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing session_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!payload.event_type || !VALID_EVENT_TYPES.includes(payload.event_type)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing event_type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!payload.page_url) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing page_url" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(payload.session_id)) {
      console.warn(`Rate limit exceeded for session: ${payload.session_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Clean up old rate limit entries occasionally
    if (Math.random() < 0.01) {
      cleanupRateLimitCache();
    }

    // Sanitize input
    const sanitizedEvent = {
      session_id: payload.session_id,
      event_type: payload.event_type,
      page_url: sanitizeString(payload.page_url, 2000) || "",
      referrer_url: sanitizeString(payload.referrer_url, 2000),
      user_agent: sanitizeString(payload.user_agent, 500),
      screen_width: typeof payload.screen_width === "number" && payload.screen_width > 0 && payload.screen_width < 10000
        ? Math.floor(payload.screen_width)
        : null,
      screen_height: typeof payload.screen_height === "number" && payload.screen_height > 0 && payload.screen_height < 10000
        ? Math.floor(payload.screen_height)
        : null,
      timezone: sanitizeString(payload.timezone, 100),
      user_id: payload.user_id && isValidUUID(payload.user_id) ? payload.user_id : null,
      metadata: payload.metadata && typeof payload.metadata === "object"
        ? JSON.parse(JSON.stringify(payload.metadata).slice(0, 5000)) // Limit metadata size
        : {},
    };

    // Insert into database using service role (bypasses RLS for insert)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: insertError } = await supabaseAdmin
      .from("tracking_events")
      .insert(sanitizedEvent);

    if (insertError) {
      console.error("Error inserting tracking event:", insertError);
      // Don't expose internal errors to client
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record event" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Success - return minimal response for performance
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in track function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
