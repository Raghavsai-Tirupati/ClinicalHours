import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import {
  GMAIL_DISCONNECT_MAX_PER_HOUR,
  jsonRateLimitResponse,
  rateLimitKeyDisconnect,
  reserveOAuthStep,
} from "../_shared/rate-limit.ts";

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

    const { data: hospitalPage, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email, gmail_refresh_token")
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
      rateLimitKeyDisconnect(authData.user.id),
      GMAIL_DISCONNECT_MAX_PER_HOUR,
    );
    if (!rl.allowed) {
      return jsonRateLimitResponse(corsHeaders, rl.retryAfterSeconds);
    }

    // Best-effort revoke
    if (hospitalPage.gmail_refresh_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(hospitalPage.gmail_refresh_token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (e) {
        console.warn("Gmail token revocation failed (non-fatal):", e);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("hospital_pages")
      .update({
        gmail_refresh_token: null,
        gmail_email: null,
        gmail_connected_at: null,
      })
      .eq("id", hospitalPageId);

    if (updateError) {
      throw new Error("Failed to clear Gmail credentials");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("gmail-disconnect error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
