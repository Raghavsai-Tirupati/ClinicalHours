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

    const { position_id, answers } = await req.json();

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

    // Verify position is active and deadline hasn't passed
    const { data: position, error: posErr } = await supabaseAdmin
      .from("hospital_positions")
      .select("id, status, application_deadline")
      .eq("id", position_id)
      .single();

    if (posErr || !position) {
      return new Response(JSON.stringify({ error: "Position not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (position.status !== "active") {
      return new Response(JSON.stringify({ error: "This position is not currently accepting applications" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (position.application_deadline && new Date(position.application_deadline) < new Date()) {
      return new Response(JSON.stringify({ error: "The application deadline has passed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate application
    const { data: existing } = await supabaseAdmin
      .from("student_applications")
      .select("id")
      .eq("position_id", position_id)
      .eq("student_id", auth.user.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "You have already applied to this position" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create application
    const { data: app, error: appErr } = await supabaseAdmin
      .from("student_applications")
      .insert({
        position_id,
        student_id: auth.user.id,
      })
      .select("id")
      .single();

    if (appErr) throw appErr;

    // Insert answers if provided
    if (answers && Array.isArray(answers) && answers.length > 0) {
      const answerRows = answers.map((a: { question_id: string; answer_text?: string; answer_file_url?: string }) => ({
        application_id: app.id,
        question_id: a.question_id,
        answer_text: a.answer_text || null,
        answer_file_url: a.answer_file_url || null,
      }));

      const { error: ansErr } = await supabaseAdmin
        .from("application_answers")
        .insert(answerRows);
      if (ansErr) throw ansErr;
    }

    return new Response(JSON.stringify({ id: app.id }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting application:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
