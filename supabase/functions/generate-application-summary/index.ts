import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

interface SummaryRequest {
  hospitalPageId: string;
  applicationIds: string[];
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
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let payload: SummaryRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalPageId, applicationIds } = payload;
    if (!hospitalPageId) {
      return new Response(
        JSON.stringify({ success: false, error: "hospitalPageId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const validIds = Array.isArray(applicationIds)
      ? applicationIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];
    if (validIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, summaries: {} }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    // Cap at 50 per request to avoid timeouts
    if (validIds.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: "Max 50 applications per request" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user identity
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const userEmail = user.email?.trim().toLowerCase();
    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "User email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Verify hospital ownership
    const { data: hospitalPage, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email")
      .eq("id", hospitalPageId)
      .maybeSingle();

    if (pageError || !hospitalPage) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital page not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if ((hospitalPage.admin_email ?? "").trim().toLowerCase() !== userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Fetch applications with answers, scoped to this hospital's positions
    const { data: apps, error: appsError } = await supabaseAdmin
      .from("student_applications")
      .select(`
        id, ai_summary, applicant_name,
        hospital_positions!inner(hospital_page_id, title),
        application_answers(answer_text, position_questions(question_text))
      `)
      .in("id", validIds)
      .eq("hospital_positions.hospital_page_id", hospitalPageId);

    if (appsError) {
      throw new Error("Failed to fetch applications");
    }

    const summaries: Record<string, string> = {};
    const toGenerate: Array<{ id: string; prompt: string }> = [];

    for (const app of apps ?? []) {
      // If already cached, return it
      if (app.ai_summary) {
        summaries[app.id] = app.ai_summary;
        continue;
      }

      // Build Q&A text for the prompt
      const answers = (app.application_answers ?? []) as Array<{
        answer_text: string | null;
        position_questions: { question_text: string } | { question_text: string }[] | null;
      }>;

      const qaPairs = answers
        .map((a) => {
          const q = Array.isArray(a.position_questions)
            ? a.position_questions[0]?.question_text
            : a.position_questions?.question_text;
          return q && a.answer_text ? `Q: ${q}\nA: ${a.answer_text}` : null;
        })
        .filter(Boolean)
        .join("\n\n");

      if (!qaPairs) {
        summaries[app.id] = "No application answers provided.";
        // Cache the fallback
        await supabaseAdmin
          .from("student_applications")
          .update({ ai_summary: summaries[app.id] })
          .eq("id", app.id);
        continue;
      }

      const positionTitle = Array.isArray(app.hospital_positions)
        ? (app.hospital_positions[0] as { title?: string })?.title ?? "a position"
        : (app.hospital_positions as { title?: string })?.title ?? "a position";

      toGenerate.push({
        id: app.id,
        prompt: `You are reviewing a student's application for "${positionTitle}". Summarize the following Q&A in exactly one concise sentence (max 120 chars) that captures the applicant's key strengths or fit. Be specific, not generic.\n\nApplicant: ${app.applicant_name ?? "Unknown"}\n\n${qaPairs}`,
      });
    }

    // Generate summaries in parallel (batches of 5)
    for (let i = 0; i < toGenerate.length; i += 5) {
      const batch = toGenerate.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async ({ id, prompt }) => {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 100,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (!response.ok) {
            console.error(`Claude API error for ${id}:`, await response.text());
            return { id, summary: "Summary unavailable." };
          }

          const data = await response.json();
          const summary =
            data.content?.[0]?.text?.trim() || "Summary unavailable.";
          return { id, summary };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { id, summary } = result.value;
          summaries[id] = summary;
          // Cache in DB
          await supabaseAdmin
            .from("student_applications")
            .update({ ai_summary: summary })
            .eq("id", id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, summaries }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("generate-application-summary error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate summaries",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
