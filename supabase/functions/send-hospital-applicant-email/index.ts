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

interface InterviewInviteTemplateData {
  recipientName: string;
  clinicName: string;
  bookingUrl: string;
  customMessage?: string;
  adminName: string;
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

function deriveAdminName(userEmail: string, fullName?: string | null): string {
  const cleanedFullName = fullName?.trim();
  if (cleanedFullName) return cleanedFullName;
  const localPart = userEmail.split("@")[0] ?? "Clinic Admin";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  if (!normalized) return "Clinic Admin";
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildInterviewInviteEmailHtml(data: InterviewInviteTemplateData): string {
  const recipientName = escapeHtml(data.recipientName || "there");
  const clinicName = escapeHtml(data.clinicName || "ClinicalHours");
  const bookingUrl = escapeHtml(data.bookingUrl);
  const adminName = escapeHtml(data.adminName || "Clinic Admin");
  const safeCustomMessage = data.customMessage?.trim()
    ? `<p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#1f2937;">${formatBodyHtml(data.customMessage.trim())}</p>`
    : "";

  return `
<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interview invitation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f4f6;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6; margin:0; padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px; width:100%; background-color:#ffffff; border-collapse:separate; border-spacing:0; border-radius:14px; overflow:hidden;">
            <tr>
              <td style="padding:0; background-color:#111827; background-image:linear-gradient(130deg, #c97b6b 0%, #b8848c 44%, #9ba8c4 100%);">
                <!--[if mso]>
                <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:640px;height:74px;">
                  <v:fill color="#b8848c" />
                  <v:textbox inset="0,0,0,0">
                <![endif]-->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:22px 28px;">
                      <div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; line-height:30px; font-weight:700; letter-spacing:0.2px; color:#ffffff;">
                        ClinicalHours
                      </div>
                    </td>
                  </tr>
                </table>
                <!--[if mso]>
                  </v:textbox>
                </v:rect>
                <![endif]-->
              </td>
            </tr>

            <tr>
              <td style="padding:26px 28px 10px 28px; font-family:Arial, Helvetica, sans-serif;">
                <h1 style="margin:0; font-size:26px; line-height:34px; font-weight:700; color:#111827;">
                  You've been invited to interview
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 0 28px; font-family:Arial, Helvetica, sans-serif;">
                <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#1f2937;">
                  Hi ${recipientName},
                </p>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#1f2937;">
                  Your application has been reviewed, and <strong>${clinicName}</strong> would like to move forward with an interview.
                </p>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#1f2937;">
                  Please review the interview details below and use the scheduling button to pick your preferred time.
                </p>
                ${safeCustomMessage}
              </td>
            </tr>

            <tr>
              <td style="padding:4px 28px 0 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #c9d6ee; background-color:#f8fafc; border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px; font-family:Arial, Helvetica, sans-serif;">
                      <p style="margin:0 0 8px 0; font-size:14px; line-height:22px; color:#111827;"><strong>Date / Window:</strong> Choose your preferred date in the scheduler</p>
                      <p style="margin:0 0 8px 0; font-size:14px; line-height:22px; color:#111827;"><strong>Available slots:</strong> Live availability shown after clicking the button</p>
                      <p style="margin:0 0 8px 0; font-size:14px; line-height:22px; color:#111827;"><strong>Location / Format:</strong> Listed on the scheduling page</p>
                      <p style="margin:0; font-size:14px; line-height:22px; color:#111827;"><strong>Clinic:</strong> ${clinicName}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 28px 6px 28px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${bookingUrl}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="16%" strokecolor="#b8848c" fillcolor="#b8848c">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:15px;font-weight:700;">
                    Schedule your slot
                  </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="border-radius:10px; background-color:#c97b6b; background-image:linear-gradient(130deg, #c97b6b 0%, #b8848c 44%, #9ba8c4 100%);">
                      <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:15px; font-weight:700; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:10px;">
                        Schedule your slot
                      </a>
                    </td>
                  </tr>
                </table>
                <!--<![endif]-->
              </td>
            </tr>

            <tr>
              <td style="padding:0 28px 0 28px; font-family:Arial, Helvetica, sans-serif;">
                <p style="margin:0; font-size:12px; line-height:20px; color:#6b7280;">
                  If the button does not work, paste this URL into your browser:<br />
                  <a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" style="color:#6b7280; text-decoration:underline; word-break:break-all;">${bookingUrl}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 28px 8px 28px; font-family:Arial, Helvetica, sans-serif;">
                <p style="margin:0 0 6px 0; font-size:15px; line-height:24px; color:#1f2937;">Questions? Reply directly to this email.</p>
                <p style="margin:0; font-size:15px; line-height:24px; color:#1f2937;">
                  ${adminName}<br />
                  ${clinicName}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 28px 24px 28px; font-family:Arial, Helvetica, sans-serif;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e5e7eb;">
                  <tr>
                    <td style="padding-top:12px;">
                      <p style="margin:0 0 4px 0; font-size:12px; line-height:18px; color:#6b7280;">
                        ClinicalHours · <a href="https://clinicalhours.org" target="_blank" rel="noopener noreferrer" style="color:#6b7280; text-decoration:underline;">clinicalhours.org</a>
                      </p>
                      <p style="margin:0; font-size:11px; line-height:17px; color:#9ca3af;">
                        You are receiving this email because you applied through ClinicalHours and a clinic selected your application for an interview.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
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
    const adminName = deriveAdminName(user.email ?? "", (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined));

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
          ? buildInterviewInviteEmailHtml({
            recipientName: recipient.name,
            clinicName: "our clinic team",
            bookingUrl: interviewBookingUrl,
            customMessage,
            adminName,
          })
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
