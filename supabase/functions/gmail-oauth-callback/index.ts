/**
 * gmail-oauth-callback
 *
 * Called by the frontend after Google redirects to /auth/google/callback.
 * Exchanges the authorisation code for tokens (using the secret server-side),
 * then stores the refresh token against the hospital_pages row.
 *
 * POST  { code: string, state: string }
 * Returns { success: true, gmail_email: string }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { exchangeCodeForTokens } from "../_shared/gmail.ts";

const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") ?? "https://clinicalhours.org/auth/google/callback";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function decodeState(state: string): { hospitalPageId: string } | null {
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (padded.length % 4)) % 4;
    const decoded = atob(padded + "=".repeat(pad));
    return JSON.parse(decoded) as { hospitalPageId: string };
  } catch {
    return null;
  }
}

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

    const { code, state } = await req.json() as { code?: string; state?: string };
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization code is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!state) {
      return new Response(
        JSON.stringify({ success: false, error: "State parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const statePayload = decodeState(state);
    if (!statePayload?.hospitalPageId) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid state parameter" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalPageId } = statePayload;

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const userEmail = user.email?.trim().toLowerCase() ?? "";

    // Confirm the caller owns this hospital page.
    const { data: page, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email")
      .eq("id", hospitalPageId)
      .maybeSingle();

    if (pageError || !page) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital page not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if ((page.admin_email ?? "").trim().toLowerCase() !== userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Exchange the authorisation code for tokens — uses GOOGLE_CLIENT_SECRET server-side.
    const { refreshToken, email: gmailEmail } = await exchangeCodeForTokens({
      code,
      redirectUri: GOOGLE_REDIRECT_URI,
    });

    // Persist the refresh token and connected Gmail address.
    const { error: updateError } = await supabaseAdmin
      .from("hospital_pages")
      .update({
        gmail_refresh_token: refreshToken,
        gmail_email: gmailEmail,
        gmail_connected_at: new Date().toISOString(),
      })
      .eq("id", hospitalPageId);

    if (updateError) {
      throw new Error(`Failed to save Gmail credentials: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, gmail_email: gmailEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("gmail-oauth-callback error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete Gmail connection",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
