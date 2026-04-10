import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin, authenticateFromCookie } from "../_shared/auth.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      .select("id, status, application_deadline, spots_available, ask_for_availability")
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

    const requestedAvailability =
      availability !== undefined &&
      availability !== null &&
      typeof availability === "object" &&
      !Array.isArray(availability)
        ? availability as Record<string, unknown>
        : null;
    const availabilityJson = position.ask_for_availability === false ? null : requestedAvailability;

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

    // Fire-and-forget admin notification — never block or fail the submission
    ;(async () => {
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) return;

        const { data: positionDetail } = await supabaseAdmin
          .from("hospital_positions")
          .select("title, hospital_page_id")
          .eq("id", position_id)
          .maybeSingle();

        if (!positionDetail?.hospital_page_id) return;

        const { data: hospitalPage } = await supabaseAdmin
          .from("hospital_pages")
          .select("admin_email, opportunity:opportunities(name)")
          .eq("id", positionDetail.hospital_page_id)
          .maybeSingle();

        if (!hospitalPage?.admin_email) return;

        const safeApplicantName = escapeHtml(applicantName ?? "A student");
        const safeApplicantEmail = escapeHtml(applicantEmail ?? "(no email on file)");
        const safePositionTitle = escapeHtml(positionDetail.title ?? "Unknown Position");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hospitalName: string = escapeHtml((hospitalPage.opportunity as any)?.name ?? "your hospital");
        const dashboardLink = `https://clinicalhours.org/hospital/${escapeHtml(positionDetail.hospital_page_id)}`;

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#4F46E5;margin-bottom:8px;">New Application Received</h2>
            <p style="font-size:16px;color:#374151;">
              A new application has been submitted for <strong>${safePositionTitle}</strong> at <strong>${hospitalName}</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr>
                <td style="padding:8px 0;color:#6b7280;width:140px;">Applicant Name</td>
                <td style="padding:8px 0;color:#111827;font-weight:500;">${safeApplicantName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;">Applicant Email</td>
                <td style="padding:8px 0;color:#111827;font-weight:500;">${safeApplicantEmail}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;">Position</td>
                <td style="padding:8px 0;color:#111827;font-weight:500;">${safePositionTitle}</td>
              </tr>
            </table>
            <a href="${dashboardLink}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">
              View in Dashboard
            </a>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="color:#9ca3af;font-size:12px;">The ClinicalHours Team</p>
          </div>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClinicalHours <support@clinicalhours.org>",
            to: [hospitalPage.admin_email],
            subject: `New application received — ${safePositionTitle}`,
            html,
          }),
        });
      } catch (e) {
        console.warn("[notify-admin] failed silently:", e);
      }
    })();

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
