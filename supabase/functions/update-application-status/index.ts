import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin, authenticateFromCookie } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const originCheck = validateOrigin(req);
  if (!originCheck.valid) {
    return new Response(JSON.stringify({ error: originCheck.error }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = await authenticateFromCookie(req);
    if (!auth.success || !auth.user) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.statusCode || 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { application_id, status, notes } = await req.json();

    if (!application_id || !status) {
      return new Response(JSON.stringify({ error: "application_id and status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validStatuses = ["new", "under_review", "accepted", "rejected", "waitlisted"];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get application → position → hospital_page to verify admin access
    const { data: app, error: appErr } = await supabaseAdmin
      .from("student_applications")
      .select("id, position_id")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pos } = await supabaseAdmin
      .from("hospital_positions")
      .select("hospital_page_id")
      .eq("id", app.position_id)
      .single();

    if (!pos) {
      return new Response(JSON.stringify({ error: "Position not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: page } = await supabaseAdmin
      .from("hospital_pages")
      .select("admin_email")
      .eq("id", pos.hospital_page_id)
      .single();

    if (!page || page.admin_email !== auth.user.email) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update application status
    const updateData: Record<string, unknown> = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
    };
    if (notes !== undefined) updateData.notes = notes;

    const { error: upErr } = await supabaseAdmin
      .from("student_applications")
      .update(updateData)
      .eq("id", application_id);

    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating application status:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
