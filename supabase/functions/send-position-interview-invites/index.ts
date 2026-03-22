import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { sendViaGmail } from "../_shared/gmail.ts";
import { jsonRateLimitResponse, reserveGmailSendBatch } from "../_shared/rate-limit.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "ClinicalHours <support@clinicalhours.org>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface InviteRequest {
  hospitalPageId: string;
  applicationIds: string[];
  emailType?: "general" | "interview_invite";
  subject?: string;
  body?: string;
  customMessage?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBodyHtml(body: string): string {
  return escapeHtml(body).replace(/\n/g, "<br>");
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
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
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let payload: InviteRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalPageId, applicationIds, emailType, subject, body, customMessage } = payload;
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
        JSON.stringify({ success: false, error: "Select at least one application" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (validIds.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many selected applications" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    const { data: hospitalPage, error: pageError } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email, interview_booking_url, gmail_refresh_token, gmail_email, opportunities:hospital_id(name)")
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
        JSON.stringify({ success: false, error: "Hospital page access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const hospitalName = (hospitalPage as { opportunities?: { name?: string } | null }).opportunities?.name ?? "";
    const selectedEmailType = emailType === "general" ? "general" : "interview_invite";
    if (selectedEmailType === "interview_invite" && !hospitalName.toLowerCase().includes("bcs free health clinic")) {
      return new Response(
        JSON.stringify({ success: false, error: "Interview invite flow is currently enabled only for BCS Free Health Clinic" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const bookingUrl = hospitalPage.interview_booking_url?.trim() ?? "";
    // Determine whether to send via the clinic admin's Gmail account or fall back to Resend.
    const gmailRefreshToken = (hospitalPage as { gmail_refresh_token?: string | null }).gmail_refresh_token ?? null;
    const gmailFrom = (hospitalPage as { gmail_email?: string | null }).gmail_email ?? null;
    const useGmail = Boolean(gmailRefreshToken && gmailFrom);

    if (selectedEmailType === "interview_invite" && !bookingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Interview booking link is not configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (selectedEmailType === "general") {
      if (!subject?.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: "Email subject is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      if (!body?.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: "Email body is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    const { data: apps, error: appsError } = await supabaseAdmin
      .from("student_applications")
      .select("id, applicant_name, applicant_email, hospital_positions!inner(hospital_page_id)")
      .in("id", validIds)
      .eq("hospital_positions.hospital_page_id", hospitalPageId);

    if (appsError) {
      throw new Error("Failed to fetch selected applications");
    }

    const recipients = new Map<string, { email: string; name: string }>();
    for (const app of apps ?? []) {
      const email = normalizeEmail(app.applicant_email);
      if (!email) continue;
      if (!recipients.has(email)) {
        recipients.set(email, {
          email,
          name: app.applicant_name?.trim() || "Applicant",
        });
      }
    }

    if (recipients.size === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, total: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (useGmail) {
      const batchRl = await reserveGmailSendBatch(supabaseAdmin, hospitalPageId, recipients.size);
      if (!batchRl.allowed) {
        return jsonRateLimitResponse(corsHeaders, batchRl.retryAfterSeconds);
      }
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients.values()) {
      const emailSubject = selectedEmailType === "general"
        ? (subject as string).trim()
        : "Interview invitation - schedule your slot";

      const emailHtml = selectedEmailType === "general"
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Hi ${escapeHtml(recipient.name)},</h2>
            <div style="line-height: 1.6; color: #333;">${formatBodyHtml((body as string).trim())}</div>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Hi ${escapeHtml(recipient.name)},</h2>
            <p style="line-height: 1.6; color: #333;">
              You have been invited to schedule an interview with BCS Free Health Clinic.
            </p>
            ${
              customMessage?.trim()
                ? `<p style="line-height: 1.6; color: #333;">${formatBodyHtml(customMessage.trim())}</p>`
                : ""
            }
            <p style="margin: 16px 0;">
              <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                Schedule Interview
              </a>
            </p>
            <p style="line-height: 1.6; color: #333;">
              If the button does not work, copy this URL into your browser:<br/>
              <span style="font-size: 12px; color: #555;">${escapeHtml(bookingUrl)}</span>
            </p>
          </div>
        `;

      try {
        if (useGmail) {
          await sendViaGmail({
            refreshToken: gmailRefreshToken!,
            fromEmail: gmailFrom!,
            toEmail: recipient.email,
            subject: emailSubject,
            html: emailHtml,
          });
          sent++;
        } else {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: [recipient.email],
              subject: emailSubject,
              html: emailHtml,
            }),
          });

          if (emailResponse.ok) {
            sent++;
          } else {
            failed++;
            const errorData = await emailResponse.json().catch(() => ({})) as Record<string, string>;
            console.error("Resend API error for", recipient.email, JSON.stringify(errorData));
            if (errors.length < 5) {
              errors.push(`${recipient.email}: ${errorData?.message ?? errorData?.error ?? JSON.stringify(errorData)}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }
        }
      } catch (err: unknown) {
        failed++;
        console.error("Error sending to", recipient.email, err);
        if (errors.length < 5) {
          errors.push(`${recipient.email}: ${err instanceof Error ? err.message : "Failed to send"}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: recipients.size,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("send-position-interview-invites error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send interview invites",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
