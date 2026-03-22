import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { buildGoogleOAuthUrl } from "../_shared/gmail.ts";
import {
  GMAIL_OAUTH_INITIATE_MAX_PER_HOUR,
  jsonRateLimitResponse,
  rateLimitKeyOAuthInitiate,
  reserveOAuthStep,
} from "../_shared/rate-limit.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
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
    if (!GOOGLE_CLIENT_ID) {
      return new Response(
        JSON.stringify({ success: false, error: "Google OAuth not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let payload: { hospitalPageId: string };
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalPageId } = payload;
    if (!hospitalPageId) {
      return new Response(
        JSON.stringify({ success: false, error: "hospitalPageId is required" }),
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
    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "User email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

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
      rateLimitKeyOAuthInitiate(authData.user.id),
      GMAIL_OAUTH_INITIATE_MAX_PER_HOUR,
    );
    if (!rl.allowed) {
      return jsonRateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    // base64url encode state
    const stateJson = JSON.stringify({ hospitalPageId });
    const state = btoa(stateJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const url = buildGoogleOAuthUrl({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      state,
    });

    return new Response(
      JSON.stringify({ success: true, url }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("gmail-oauth-initiate error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
