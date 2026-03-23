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
  htmlBody?: string;
  customMessage?: string;
  attachments?: Array<{ fileName?: string; publicUrl?: string }>;
}

interface InterviewInviteTemplateData {
  recipientName: string;
  clinicName: string;
  positionName: string;
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

function getBodyPreview(input: string, max = 400): string {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
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
  const positionName = escapeHtml(data.positionName || "the position you applied for");
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
                  Your application for <strong>${positionName}</strong> has been reviewed, and <strong>${clinicName}</strong> would like to move forward with an interview.
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

function escapeAttachmentUrl(url: string): string {
  // Minimal escaping since URLs are expected to be already public; we still escape special chars.
  return escapeHtml(url);
}

function buildAttachmentsHtml(attachments: Array<{ fileName?: string; publicUrl?: string }>): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return "";

  const itemsHtml = attachments
    .map((att) => {
      const name = att.fileName?.trim();
      const url = att.publicUrl?.trim();
      if (!name || !url) return "";
      return `<li style="margin: 4px 0;"><a href="${escapeAttachmentUrl(url)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(name)}</a></li>`;
    })
    .filter(Boolean)
    .join("");

  if (!itemsHtml) return "";

  return `
    <div style="margin-top: 16px;">
      <p style="font-size: 13px; color: #555; margin: 0 0 8px 0;">Attachments</p>
      <ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul>
    </div>
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

    let payload: InviteRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalPageId, applicationIds, emailType, subject, body, htmlBody, customMessage, attachments } = payload;
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
    const adminName = deriveAdminName(userEmail, (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined));
    const selectedEmailType = emailType === "general" ? "general" : "interview_invite";

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

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments.filter((a) => a && typeof a.fileName === "string" && typeof a.publicUrl === "string")
      : [];

    const { data: apps, error: appsError } = await supabaseAdmin
      .from("student_applications")
      .select("id, position_id, applicant_name, applicant_email, status, interview_invited_at")
      .in("id", validIds);

    if (appsError) {
      console.error("Failed to fetch selected applications:", appsError);
      throw new Error("Failed to fetch selected applications");
    }

    const positionIds = [...new Set((apps ?? []).map((app) => app.position_id).filter(Boolean))];
    if (positionIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid applications were selected" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: allowedPositions, error: allowedPositionsError } = await supabaseAdmin
      .from("hospital_positions")
      .select("id")
      .in("id", positionIds)
      .eq("hospital_page_id", hospitalPageId);

    if (allowedPositionsError) {
      console.error("Failed to validate application ownership:", allowedPositionsError);
      throw new Error("Failed to validate selected applications");
    }

    const allowedPositionIds = new Set((allowedPositions ?? []).map((position) => position.id));
    const selectedApps = (apps ?? []).filter((app) => allowedPositionIds.has(app.position_id));
    const { data: selectedPositionRows } = await supabaseAdmin
      .from("hospital_positions")
      .select("id, title")
      .in("id", [...allowedPositionIds]);
    const positionTitleById = new Map<string, string>();
    for (const row of selectedPositionRows ?? []) {
      positionTitleById.set(row.id, row.title?.trim() || "the position you applied for");
    }

    if (selectedApps.length !== (apps ?? []).length) {
      return new Response(
        JSON.stringify({ success: false, error: "Some selected applications do not belong to this clinic" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    type Recipient = {
      email: string;
      name: string;
      pendingApplicationIds: string[];
      pendingPositionNames: string[];
    };

    const recipients = new Map<string, Recipient>();
    for (const app of selectedApps) {
      const email = normalizeEmail(app.applicant_email);
      if (!email) continue;
      if (!recipients.has(email)) {
        recipients.set(email, {
          email,
          name: app.applicant_name?.trim() || "Applicant",
          pendingApplicationIds: [],
          pendingPositionNames: [],
        });
      }
      // Idempotency: if we've already marked this app as invited, don't spam another email.
      if (selectedEmailType === "interview_invite" && !app.interview_invited_at) {
        recipients.get(email)!.pendingApplicationIds.push(app.id);
        const positionTitle = positionTitleById.get(app.position_id) || "the position you applied for";
        if (!recipients.get(email)!.pendingPositionNames.includes(positionTitle)) {
          recipients.get(email)!.pendingPositionNames.push(positionTitle);
        }
      }
    }

    const recipientsToSend = selectedEmailType === "interview_invite"
      ? [...recipients.values()].filter((r) => r.pendingApplicationIds.length > 0)
      : [...recipients.values()];

    if (recipientsToSend.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, total: recipients.size }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (useGmail) {
      const batchRl = await reserveGmailSendBatch(supabaseAdmin, hospitalPageId, recipientsToSend.length);
      if (!batchRl.allowed) {
        return jsonRateLimitResponse(corsHeaders, batchRl.retryAfterSeconds);
      }
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const invitedApplicationIdsToUpdate: string[] = [];

    for (const recipient of recipientsToSend) {
      let didSend = false;
      const emailSubject = selectedEmailType === "general"
        ? (subject as string).trim()
        : "Interview invitation - schedule your slot";

      const attachmentsHtml = selectedEmailType === "general" ? buildAttachmentsHtml(normalizedAttachments) : "";
      const emailHtml = selectedEmailType === "general"
        ? ((htmlBody?.trim().length ?? 0) > 0
          ? `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.6; color: #333;">
            ${htmlBody}
            ${attachmentsHtml}
          </div>
        `
          : `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color: #1a1a2e;">Hi ${escapeHtml(recipient.name)},</h2>
            <div style="line-height: 1.6; color: #333;">${formatBodyHtml((body as string).trim())}</div>
            ${attachmentsHtml}
          </div>
        `)
        : buildInterviewInviteEmailHtml({
          recipientName: recipient.name,
          clinicName: hospitalName || "our clinic team",
          positionName: recipient.pendingPositionNames.join(", ") || "the position you applied for",
          bookingUrl,
          customMessage,
          adminName,
        });

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
          didSend = true;
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
            didSend = true;
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

      // Track invite timestamp only when the email was successfully sent.
      if (selectedEmailType === "interview_invite" && didSend && recipient.pendingApplicationIds.length > 0) {
        invitedApplicationIdsToUpdate.push(...recipient.pendingApplicationIds);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const invitedAppIdsUnique = [...new Set(invitedApplicationIdsToUpdate)];
    if (selectedEmailType === "interview_invite" && invitedAppIdsUnique.length > 0) {
      const { error: invitedError } = await supabaseAdmin
        .from("student_applications")
        .update({ interview_invited_at: new Date().toISOString() })
        .in("id", invitedAppIdsUnique);
      if (invitedError) {
        console.error("Failed to persist interview_invited_at:", invitedError.message, invitedError);
      }
    }

    let activityLogged = true;
    if (selectedEmailType === "general" && sent > 0) {
      const { error: activityError } = await supabaseAdmin
        .from("admin_activity_log")
        .insert({
          hospital_page_id: hospitalPageId,
          actor_email: userEmail,
          action_type: "email_sent",
          target_type: "email",
          metadata: {
            subject: (subject as string).trim(),
            recipientCount: sent,
            applicationIds: validIds,
            bodyPreview: getBodyPreview((body as string).trim()),
            attachmentCount: normalizedAttachments.length,
          },
        });
      if (activityError) {
        activityLogged = false;
        console.error("Failed to persist admin_activity_log:", activityError.message, activityError);
      }
    }
    if (selectedEmailType === "interview_invite" && sent > 0) {
      const { error: activityError } = await supabaseAdmin
        .from("admin_activity_log")
        .insert({
          hospital_page_id: hospitalPageId,
          actor_email: userEmail,
          action_type: "interview_invited",
          target_type: "email",
          target_id: null,
          metadata: {
            recipientCount: sent,
            applicationIds: invitedAppIdsUnique,
            bookingUrl,
          },
        });
      if (activityError) {
        activityLogged = false;
        console.error("Failed to persist admin_activity_log:", activityError.message, activityError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: recipients.size,
        activityLogged,
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
