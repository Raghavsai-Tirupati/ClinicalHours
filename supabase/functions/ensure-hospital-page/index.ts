import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

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

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const email = user.email.toLowerCase().trim();

    // Check if hospital_pages record already exists for this email
    const { data: existing, error: selectError } = await supabaseAdmin
      .from("hospital_pages")
      .select("*, opportunities:hospital_id (id, name, location, type, website, logo_url, description)")
      .eq("admin_email", email)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("Error checking hospital page:", selectError);
      throw new Error("Failed to check hospital page");
    }

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, page: existing, created: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Find an opportunity linked to this user via hospital_members → hospital_accounts → opportunities
    const { data: member } = await supabaseAdmin
      .from("hospital_members")
      .select("account_id, hospital_accounts (hospital_id)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: "No hospital association found for your account" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hospitalId = (member.hospital_accounts as any)?.hospital_id;
    if (!hospitalId) {
      return new Response(
        JSON.stringify({ success: false, error: "No hospital linked to your account" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Find the opportunity record for this hospital
    const { data: opp } = await supabaseAdmin
      .from("opportunities")
      .select("id")
      .eq("hospital_id", hospitalId)
      .limit(1)
      .maybeSingle();

    if (!opp) {
      return new Response(
        JSON.stringify({ success: false, error: "No opportunity found for your hospital" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Create hospital_pages record
    const { data: page, error: insertError } = await supabaseAdmin
      .from("hospital_pages")
      .insert({
        hospital_id: opp.id,
        admin_email: email,
        is_claimed: true,
        created_by: user.id,
      })
      .select("*, opportunities:hospital_id (id, name, location, type, website, logo_url, description)")
      .single();

    if (insertError) {
      // Handle unique constraint violation (race condition)
      if (insertError.code === "23505") {
        const { data: raceResult } = await supabaseAdmin
          .from("hospital_pages")
          .select("*, opportunities:hospital_id (id, name, location, type, website, logo_url, description)")
          .eq("admin_email", email)
          .limit(1)
          .maybeSingle();

        return new Response(
          JSON.stringify({ success: true, page: raceResult, created: false }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      console.error("Error creating hospital page:", insertError);
      throw new Error("Failed to create hospital page");
    }

    return new Response(
      JSON.stringify({ success: true, page, created: true }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error in ensure-hospital-page:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
