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

    const { position_id, answers, availability } = await req.json();

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

    // Verify position is active
    const { data: position, error: posErr } = await supabaseAdmin
      .from("hospital_positions")
      .select("id, status, application_deadline, spots_available")
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

    // Check spots available
    if (position.spots_available != null) {
      const { count } = await supabaseAdmin
        .from("student_applications")
        .select("id", { count: "exact", head: true })
        .eq("position_id", position_id)
        .eq("status", "accepted");

      if (count != null && count >= position.spots_available) {
        return new Response(JSON.stringify({ error: "All spots for this position have been filled" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .maybeSingle();

    const profileName = profile?.full_name?.trim() || null;

    // Fetch user metadata from auth.users for fallback name
    let metaName: string | null = null;
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(auth.user.id);
    if (authUserData?.user?.user_metadata?.full_name) {
      const raw = authUserData.user.user_metadata.full_name;
      metaName = typeof raw === "string" ? raw.trim() : null;
    }
    const applicantName = profileName || metaName || null;
    const applicantEmail = auth.user.email?.trim().toLowerCase() || null;

    const availabilityJson =
      availability !== undefined &&
      availability !== null &&
      typeof availability === "object" &&
      !Array.isArray(availability)
        ? availability as Record<string, unknown>
        : null;

    // Create application
    const { data: app, error: appErr } = await supabaseAdmin
      .from("student_applications")
      .insert({
        position_id,
        student_id: auth.user.id,
        applicant_name: applicantName,
        applicant_email: applicantEmail,
        availability_json: availabilityJson,
      })
      .select("*")
      .single();

    if (appErr) throw appErr;

    // Insert answers if provided. If this fails, remove the created application
    // so users do not end up with partial submissions.
    let createdAnswers: unknown[] = [];
    if (answers && Array.isArray(answers) && answers.length > 0) {
      const answerRows = answers.map((a: { question_id: string; answer_text?: string; answer_file_url?: string }) => ({
        application_id: app.id,
        question_id: a.question_id,
        answer_text: a.answer_text || null,
        answer_file_url: a.answer_file_url || null,
      }));

      const { data: ansData, error: ansErr } = await supabaseAdmin
        .from("application_answers")
        .insert(answerRows)
        .select("*");

      if (ansErr) {
        await supabaseAdmin.from("student_applications").delete().eq("id", app.id);
        throw ansErr;
      }
      createdAnswers = ansData || [];
    }

    return new Response(JSON.stringify({ ...app, answers: createdAnswers }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Error submitting application:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
