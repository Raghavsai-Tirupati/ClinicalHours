import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { exchangeCodeForTokens } from "../_shared/gmail.ts";
import {
  GMAIL_OAUTH_CALLBACK_MAX_PER_HOUR,
  jsonRateLimitResponse,
  rateLimitKeyOAuthCallback,
  reserveOAuthStep,
} from "../_shared/rate-limit.ts";

const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") ?? "https://clinicalhours.org/auth/google/callback";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let payload: { code: string; state: string };
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { code, state } = payload;
    if (!code || !state) {
      return new Response(
        JSON.stringify({ success: false, error: "code and state are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Decode base64url state
    let hospitalPageId: string;
    let csrfToken: string | undefined;
    try {
      const restored = state.replace(/-/g, "+").replace(/_/g, "/");
      const padded = restored + "=".repeat((4 - (restored.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded));
      hospitalPageId = decoded.hospitalPageId;
      csrfToken = typeof decoded.csrf === "string" ? decoded.csrf : undefined;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid state parameter" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const userEmail = authData.user.email?.trim().toLowerCase();

    // CSRF check: state token must exist server-side, belong to the current user,
    // and have been created within the last 10 minutes. Then consume it.
    if (!csrfToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired OAuth state" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: stateRow } = await supabaseAdmin
      .from("oauth_states")
      .select("user_id, created_at")
      .eq("state", csrfToken)
      .maybeSingle();

    if (!stateRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired OAuth state" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const stateAgeMs = Date.now() - new Date(stateRow.created_at).getTime();
    if (stateAgeMs > 600_000 || stateRow.user_id !== authData.user.id) {
      await supabaseAdmin.from("oauth_states").delete().eq("state", csrfToken);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired OAuth state" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // One-time use: consume immediately.
    await supabaseAdmin.from("oauth_states").delete().eq("state", csrfToken);

    const { data: hospitalPage, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email")
      .eq("id", hospitalPageId)
      .maybeSingle();

    if (pageError || !hospitalPage) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital page not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if ((hospitalPage.admin_email ?? "").trim().toLowerCase() !== userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital page access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const rl = await reserveOAuthStep(
      supabaseAdmin,
      rateLimitKeyOAuthCallback(authData.user.id),
      GMAIL_OAUTH_CALLBACK_MAX_PER_HOUR,
    );
    if (!rl.allowed) {
      return jsonRateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    const tokens = await exchangeCodeForTokens({ code, redirectUri: GOOGLE_REDIRECT_URI });

    const { error: updateError } = await supabaseAdmin
      .from("hospital_pages")
      .update({
        gmail_refresh_token: tokens.refreshToken,
        gmail_email: tokens.email,
        gmail_connected_at: new Date().toISOString(),
      })
      .eq("id", hospitalPageId);

    if (updateError) {
      throw new Error("Failed to save Gmail credentials");
    }

    return new Response(
      JSON.stringify({ success: true, gmail_email: tokens.email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("gmail-oauth-callback error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
