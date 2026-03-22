/**
 * gmail-oauth-initiate
 *
 * Generates a Google OAuth 2.0 authorisation URL for the gmail.send scope.
 * The Client ID and redirect URI are read from environment variables so they
 * never appear in the client-side bundle.
 *
 * POST  { hospitalPageId: string }
 * Returns { url: string }  — redirect the user's browser to this URL.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { buildGoogleOAuthUrl } from "../_shared/gmail.ts";

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
        JSON.stringify({ success: false, error: "Google OAuth is not configured" }),
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

    const { hospitalPageId } = await req.json() as { hospitalPageId?: string };
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
    const user = authData?.user;
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const userEmail = user.email?.trim().toLowerCase() ?? "";

    // Verify the caller is the admin for this hospital page.
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

    // Encode the hospitalPageId into the state so the callback knows where to store the token.
    const state = btoa(JSON.stringify({ hospitalPageId }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

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
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate OAuth URL",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
