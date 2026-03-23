import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";
import { sendViaGmail } from "../_shared/gmail.ts";
import { jsonRateLimitResponse, reserveGmailSendBatch } from "../_shared/rate-limit.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "ClinicalHours <support@clinicalhours.org>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface SendHospitalApplicantEmailRequest {
  accountId: string;
  subject?: string;
  body?: string;
  applicationIds?: string[];
  emailType?: "general" | "interview_invite";
  customMessage?: string;
}

interface Recipient {
  email: string;
  name: string;
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

    let payload: SendHospitalApplicantEmailRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { accountId, subject, body, applicationIds, emailType = "general", customMessage } = payload;
    if (!accountId) {
      return new Response(
        JSON.stringify({ success: false, error: "accountId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (emailType === "general" && (!subject?.trim() || !body?.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "subject and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const applicationIdFilter = Array.isArray(applicationIds)
      ? applicationIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];
    if (applicationIdFilter.length > 1000) {
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

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("hospital_members")
      .select("id")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Check whether this admin has a hospital_page with Gmail connected.
    // We match on admin_email to bridge the legacy and new admin systems.
    const { data: gmailPage } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, gmail_refresh_token, gmail_email")
      .eq("admin_email", user.email!)
      .maybeSingle();

    const gmailPageId = (gmailPage as { id?: string } | null)?.id ?? null;
    const gmailRefreshToken = (gmailPage as { gmail_refresh_token?: string | null } | null)?.gmail_refresh_token ?? null;
    const gmailFrom = (gmailPage as { gmail_email?: string | null } | null)?.gmail_email ?? null;
    const useGmail = Boolean(gmailRefreshToken && gmailFrom);

    const recipientsMap = new Map<string, Recipient>();

    let hospitalQuery = supabaseAdmin
      .from("hospital_applications")
      .select("id, applicant_email, applicant_name")
      .eq("account_id", accountId);
    if (applicationIdFilter.length > 0) {
      hospitalQuery = hospitalQuery.in("id", applicationIdFilter);
    }
    const { data: hospitalApps, error: hospitalAppsError } = await hospitalQuery;
    if (hospitalAppsError) {
      throw new Error("Failed to fetch hospital applications");
    }

    for (const row of hospitalApps ?? []) {
      const email = normalizeEmail(row.applicant_email);
      if (!email) continue;
      if (!recipientsMap.has(email)) {
        recipientsMap.set(email, {
          email,
          name: row.applicant_name?.trim() || "Applicant",
        });
      }
    }

    const { data: accountData, error: accountError } = await supabaseAdmin
      .from("hospital_accounts")
      .select("hospital_id, interview_booking_url")
      .eq("id", accountId)
      .maybeSingle();
    if (accountError || !accountData?.hospital_id) {
      throw new Error("Failed to resolve hospital account");
    }

    const interviewBookingUrl = accountData.interview_booking_url?.trim() ?? "";
    if (emailType === "interview_invite" && !interviewBookingUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Interview booking link is not configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    // Interview invite email uses the per-account scheduling URL stored on `hospital_accounts`.
    // Calendly (or the linked scheduling service) is responsible for real-time availability + booking.

    const { data: opportunities, error: opportunitiesError } = await supabaseAdmin
      .from("opportunities")
      .select("id")
      .eq("hospital_id", accountData.hospital_id);
    if (opportunitiesError) {
      throw new Error("Failed to fetch opportunities");
    }

    const opportunityIds = (opportunities ?? []).map((o) => o.id);
    if (opportunityIds.length > 0) {
      let legacyQuery = supabaseAdmin
        .from("applications")
        .select("id, student_email, student_name")
        .in("opportunity_id", opportunityIds);
      if (applicationIdFilter.length > 0) {
        legacyQuery = legacyQuery.in("id", applicationIdFilter);
      }
      const { data: legacyApps, error: legacyAppsError } = await legacyQuery;
      if (legacyAppsError) {
        throw new Error("Failed to fetch legacy applications");
      }

      for (const row of legacyApps ?? []) {
        const email = normalizeEmail(row.student_email);
        if (!email) continue;
        if (!recipientsMap.has(email)) {
          recipientsMap.set(email, {
            email,
            name: row.student_name?.trim() || "Applicant",
          });
        }
      }
    }

    const recipients = [...recipientsMap.values()];
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, total: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (useGmail && gmailPageId) {
      const batchRl = await reserveGmailSendBatch(supabaseAdmin, gmailPageId, recipients.length);
      if (!batchRl.allowed) {
        return jsonRateLimitResponse(corsHeaders, batchRl.retryAfterSeconds);
      }
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 40;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      for (const recipient of batch) {
        const emailSubject = emailType === "interview_invite"
          ? "Interview invitation - schedule your slot"
          : (subject as string);

        const emailHtml = emailType === "interview_invite"
          ? `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Hi ${escapeHtml(recipient.name)},</h2>
              <p style="line-height: 1.6; color: #333;">
                You have been invited to schedule an interview with our clinic team.
              </p>
              ${
                customMessage?.trim()
                  ? `<p style="line-height: 1.6; color: #333;">${formatBodyHtml(customMessage.trim())}</p>`
                  : ""
              }
              <p style="line-height: 1.6; color: #333;">Please use the scheduling link below:</p>
              <p style="margin: 16px 0;">
                <a href="${escapeHtml(interviewBookingUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                  Schedule Interview
                </a>
              </p>
              <p style="line-height: 1.6; color: #333;">
                If the button does not work, copy this URL into your browser:<br/>
                <span style="font-size: 12px; color: #555;">${escapeHtml(interviewBookingUrl)}</span>
              </p>
              <hr style="margin: 28px 0; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #666;">Sent from ClinicalHours on behalf of your hospital application team.</p>
            </div>
          `
          : `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2 style="color: #1a1a2e;">Hi ${escapeHtml(recipient.name)},</h2>
              <div style="line-height: 1.6; color: #333;">${formatBodyHtml(body ?? "")}</div>
              <hr style="margin: 28px 0; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #666;">Sent from ClinicalHours on behalf of your hospital application team.</p>
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
              await new Promise((resolve) => setTimeout(resolve, 80));
              continue;
            }
          }
        } catch (err) {
          failed++;
          console.error("Error sending to", recipient.email, err);
          if (errors.length < 5) {
            errors.push(`${recipient.email}: ${err instanceof Error ? err.message : "Failed to send"}`);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: recipients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("send-hospital-applicant-email error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send emails",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
