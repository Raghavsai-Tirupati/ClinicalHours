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

    const { hospital_page_id, title, description, requirements, location, position_type, hours_per_week, duration, start_date, application_deadline, spots_available, status, questions } = await req.json();

    if (!hospital_page_id || !title) {
      return new Response(JSON.stringify({ error: "hospital_page_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user is admin OR hospital page owner
    const { data: page, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("admin_email")
      .eq("id", hospital_page_id)
      .single();

    if (pageError || !page) {
      return new Response(JSON.stringify({ error: "Hospital page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check platform admin or hospital page owner
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPageOwner = page.admin_email?.toLowerCase() === auth.user.email?.toLowerCase();

    if (!adminRole && !isPageOwner) {
      return new Response(JSON.stringify({ error: "Not authorized for this hospital" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert position
    const { data: position, error: posError } = await supabaseAdmin
      .from("hospital_positions")
      .insert({
        hospital_page_id,
        title,
        description: description || null,
        requirements: requirements || null,
        location: location || null,
        position_type: position_type || "volunteer",
        hours_per_week: hours_per_week || null,
        duration: duration || null,
        start_date: start_date || null,
        application_deadline: application_deadline || null,
        spots_available: spots_available || null,
        status: status || "draft",
      })
      .select("*")
      .single();

    if (posError) throw posError;

    // Insert questions if provided
    let createdQuestions: unknown[] = [];
    if (questions && Array.isArray(questions) && questions.length > 0) {
      const questionRows = questions.map((q: { question_text: string; question_type: string; is_required: boolean; options?: string[]; display_order: number }, i: number) => ({
        position_id: position.id,
        question_text: q.question_text,
        question_type: q.question_type || "short_answer",
        is_required: q.is_required ?? true,
        options: q.options || [],
        display_order: q.display_order ?? i,
      }));

      const { data: qData, error: qError } = await supabaseAdmin
        .from("position_questions")
        .insert(questionRows)
        .select("*");

      if (qError) throw qError;
      createdQuestions = qData || [];
    }

    return new Response(JSON.stringify({ ...position, questions: createdQuestions }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Error creating position:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
