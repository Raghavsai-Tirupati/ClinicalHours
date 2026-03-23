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

    const { position_id, title, description, requirements, location, position_type, hours_per_week, duration, start_date, application_deadline, spots_available, ask_for_availability, status, questions } = await req.json();

    if (!position_id) {
      return new Response(JSON.stringify({ error: "position_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get position and verify access
    const { data: pos, error: posErr } = await supabaseAdmin
      .from("hospital_positions")
      .select("hospital_page_id")
      .eq("id", position_id)
      .single();

    if (posErr || !pos) {
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

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPageOwner = page?.admin_email?.toLowerCase() === auth.user.email?.toLowerCase();

    if (!adminRole && !isPageOwner) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update position fields
    const updateFields: Record<string, unknown> = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description || null;
    if (requirements !== undefined) updateFields.requirements = requirements || null;
    if (location !== undefined) updateFields.location = location || null;
    if (position_type !== undefined) updateFields.position_type = position_type;
    if (hours_per_week !== undefined) updateFields.hours_per_week = hours_per_week || null;
    if (duration !== undefined) updateFields.duration = duration || null;
    if (start_date !== undefined) updateFields.start_date = start_date || null;
    if (application_deadline !== undefined) updateFields.application_deadline = application_deadline || null;
    if (spots_available !== undefined) updateFields.spots_available = spots_available || null;
    if (ask_for_availability !== undefined) updateFields.ask_for_availability = ask_for_availability;
    if (status !== undefined) updateFields.status = status;

    let updatedPosition = null;
    if (Object.keys(updateFields).length > 0) {
      updateFields.updated_at = new Date().toISOString();
      const { data, error: upErr } = await supabaseAdmin
        .from("hospital_positions")
        .update(updateFields)
        .eq("id", position_id)
        .select("*")
        .single();
      if (upErr) throw upErr;
      updatedPosition = data;
    } else {
      const { data } = await supabaseAdmin
        .from("hospital_positions")
        .select("*")
        .eq("id", position_id)
        .single();
      updatedPosition = data;
    }

    // Update questions if provided
    let updatedQuestions: unknown[] = [];
    if (questions && Array.isArray(questions)) {
      await supabaseAdmin
        .from("position_questions")
        .delete()
        .eq("position_id", position_id);

      if (questions.length > 0) {
        const questionRows = questions.map((q: { question_text: string; question_type: string; is_required: boolean; options?: string[]; display_order: number }, i: number) => ({
          position_id,
          question_text: q.question_text,
          question_type: q.question_type || "short_answer",
          is_required: q.is_required ?? true,
          options: q.options || [],
          display_order: q.display_order ?? i,
        }));

        const { data: qData, error: qErr } = await supabaseAdmin
          .from("position_questions")
          .insert(questionRows)
          .select("*");
        if (qErr) throw qErr;
        updatedQuestions = qData || [];
      }
    }

    return new Response(JSON.stringify({ ...updatedPosition, questions: updatedQuestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Error updating position:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
