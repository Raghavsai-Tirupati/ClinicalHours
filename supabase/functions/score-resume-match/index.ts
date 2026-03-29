import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";

/**
 * score-resume-match
 *
 * ATS-style keyword matching: compares uploaded resume text against
 * the position's match_keywords. Generates a 0-100 score.
 *
 * Called after application submission or on-demand by clinic admin.
 *
 * Body: { application_id: string }
 * OR:   { application_id: string, resume_text: string }   (provide text directly)
 */

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-\/\+\#\.]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function computeMatchScore(
  resumeText: string,
  matchKeywords: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (!matchKeywords.length) return { score: 0, matched: [], missing: [] };

  const resumeWords = extractKeywords(resumeText);
  const resumeLower = resumeText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of matchKeywords) {
    const kwLower = kw.toLowerCase().trim();
    if (!kwLower) continue;

    // Multi-word keywords: check phrase presence
    if (kwLower.includes(" ")) {
      if (resumeLower.includes(kwLower)) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    } else {
      // Single word: check word set
      if (resumeWords.has(kwLower)) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    }
  }

  const totalKeywords = matched.length + missing.length;
  const score = totalKeywords > 0
    ? Math.round((matched.length / totalKeywords) * 100)
    : 0;

  return { score, matched, missing };
}

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
    const { application_id, resume_text: providedText } = await req.json();

    if (!application_id) {
      return new Response(
        JSON.stringify({ error: "application_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch application + position keywords
    const { data: app, error: appErr } = await supabaseAdmin
      .from("student_applications")
      .select("id, position_id, resume_text")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: position } = await supabaseAdmin
      .from("hospital_positions")
      .select("match_keywords")
      .eq("id", app.position_id)
      .single();

    const matchKeywords: string[] = position?.match_keywords || [];

    if (matchKeywords.length === 0) {
      // No keywords configured — set score to null
      await supabaseAdmin
        .from("student_applications")
        .update({ resume_match_score: null })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({ score: null, matched: [], missing: [], message: "No match keywords configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get resume text: from provided text, stored text, or fetch from documents
    let resumeText = providedText || app.resume_text || "";

    if (!resumeText) {
      // Try to find resume documents from application_documents
      const { data: docs } = await supabaseAdmin
        .from("application_documents")
        .select("file_url, file_name, file_type")
        .eq("application_id", application_id)
        .in("file_type", ["resume", "cv"])
        .limit(1);

      // Also check application_answers for file uploads with resume-like labels
      if (!docs?.length) {
        const { data: answerDocs } = await supabaseAdmin
          .from("application_answers")
          .select("answer_text, answer_file_url")
          .eq("application_id", application_id)
          .not("answer_file_url", "is", null);

        if (answerDocs?.length) {
          // Use the answer text as a fallback (often the file name)
          resumeText = answerDocs.map((a) => a.answer_text || "").join(" ");
        }
      }
    }

    // If we still have no resume text, try profile fields as fallback
    if (!resumeText) {
      const { data: profileApp } = await supabaseAdmin
        .from("student_applications")
        .select("student_id")
        .eq("id", application_id)
        .single();

      if (profileApp) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("university, major, research_experience")
          .eq("id", profileApp.student_id)
          .maybeSingle();

        if (profile) {
          resumeText = [
            profile.university,
            profile.major,
            profile.research_experience,
          ].filter(Boolean).join(" ");
        }
      }
    }

    // Collect all answer texts for additional scoring context
    const { data: allAnswers } = await supabaseAdmin
      .from("application_answers")
      .select("answer_text")
      .eq("application_id", application_id);

    const fullText = [
      resumeText,
      ...(allAnswers || []).map((a) => a.answer_text || ""),
    ].join("\n");

    const { score, matched, missing } = computeMatchScore(fullText, matchKeywords);

    // Store score and resume text
    await supabaseAdmin
      .from("student_applications")
      .update({
        resume_match_score: score,
        resume_text: resumeText.slice(0, 50000) || null, // cap at 50k chars
      })
      .eq("id", application_id);

    return new Response(
      JSON.stringify({ score, matched, missing, total_keywords: matchKeywords.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("score-resume-match error:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
