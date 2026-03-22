/**
 * gmail-disconnect
 *
 * Removes the stored Gmail OAuth credentials from a hospital_pages row
 * so that future emails fall back to the platform default (Resend).
 *
 * Also revokes the token with Google so it can't be replayed.
 *
 * POST  { hospitalPageId: string }
 * Returns { success: true }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";

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

    const { data: page, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email, gmail_refresh_token")
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

    // Best-effort token revocation with Google.
    const existingToken = (page as { gmail_refresh_token?: string | null }).gmail_refresh_token;
    if (existingToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(existingToken)}`, {
        method: "POST",
      }).catch((err) => console.warn("Token revocation failed (non-fatal):", err));
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
      throw new Error(`Failed to remove Gmail credentials: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("gmail-disconnect error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect Gmail",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
