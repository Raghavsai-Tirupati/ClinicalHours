import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface CreateHospitalPageRequest {
  hospital_id: string;
  admin_email: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    // Authenticate the caller
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
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Verify admin role
    const { isAdmin } = await checkAdminRole(user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Parse and validate request body
    let payload: CreateHospitalPageRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospital_id, admin_email } = payload;

    if (!hospital_id) {
      return new Response(
        JSON.stringify({ success: false, error: "hospital_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!admin_email || !isValidEmail(admin_email)) {
      return new Response(
        JSON.stringify({ success: false, error: "A valid admin_email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Verify hospital exists
    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from("hospitals")
      .select("id, name")
      .eq("id", hospital_id)
      .single();

    if (hospitalError || !hospital) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Check if a page already exists for this hospital
    const { data: existing } = await supabaseAdmin
      .from("hospital_pages")
      .select("id")
      .eq("hospital_id", hospital_id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: "A page already exists for this hospital" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Create the hospital_pages record
    const { data: page, error: insertError } = await supabaseAdmin
      .from("hospital_pages")
      .insert({
        hospital_id,
        admin_email: admin_email.toLowerCase().trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating hospital page:", insertError);
      throw new Error("Failed to create hospital page");
    }

    // TODO: Send invite email to admin_email via Resend when configured
    // e.g. "You've been invited to manage {hospital.name} on ClinicalHours"

    return new Response(
      JSON.stringify({
        success: true,
        page,
        hospital_name: hospital.name,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error in create-hospital-page:", error);
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
