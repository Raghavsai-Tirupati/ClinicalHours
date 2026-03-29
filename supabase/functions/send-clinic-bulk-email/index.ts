import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL")?.trim() ||
  "ClinicalHours <support@clinicalhours.org>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface Recipient {
  email: string;
  name: string;
  role?: string;
}

interface BulkEmailRequest {
  clinicId: string;
  recipients: Recipient[];
  subjectTemplate: string;
  bodyTemplate: string;
  globalVariables?: Record<string, string>;
  templateId?: string;
  templateName?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Replace {{variable}} placeholders in a template string.
 * Variable values are NOT escaped here — the email builder handles that.
 */
function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

/**
 * Wrap the body text in a branded ClinicalHours HTML email layout.
 */
function buildEmailHtml(bodyText: string, clinicName: string): string {
  const formattedBody = escapeHtml(bodyText).replace(/\n/g, "<br>");
  const safeName = escapeHtml(clinicName);

  return `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" style="background-color:#f3f4f6;padding:24px 0;">
<tr><td align="center" style="padding:0 12px;">
<table role="presentation" width="100%" style="max-width:640px;background-color:#ffffff;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;">
<tr><td style="padding:0;background-image:linear-gradient(130deg,#c97b6b 0%,#b8848c 44%,#9ba8c4 100%);">
<table role="presentation" width="100%"><tr><td style="padding:22px 28px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;font-weight:700;letter-spacing:0.2px;color:#ffffff;">ClinicalHours</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:15px;line-height:24px;color:#1f2937;">${formattedBody}</div>
</td></tr>
<tr><td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" style="border-top:1px solid #e5e7eb;"><tr><td style="padding-top:12px;">
<p style="margin:0 0 4px 0;font-size:12px;line-height:18px;color:#6b7280;">${safeName} &middot; <a href="https://clinicalhours.org" target="_blank" rel="noopener noreferrer" style="color:#6b7280;text-decoration:underline;">clinicalhours.org</a></p>
<p style="margin:0;font-size:11px;line-height:17px;color:#9ca3af;">You are receiving this email because you are a member of ${safeName} on ClinicalHours.</p>
</td></tr></table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
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
      {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    let payload: BulkEmailRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const {
      clinicId,
      recipients,
      subjectTemplate,
      bodyTemplate,
      globalVariables = {},
      templateId,
      templateName,
    } = payload;

    if (
      !clinicId ||
      !Array.isArray(recipients) ||
      recipients.length === 0 ||
      !subjectTemplate?.trim() ||
      !bodyTemplate?.trim()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "clinicId, recipients, subjectTemplate, and bodyTemplate are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    if (recipients.length > 500) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Maximum 500 recipients per send",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Authenticate caller ───────────────────────────────────
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // ── Verify clinic admin access ────────────────────────────
    const { data: clinicPage } = await supabaseAdmin
      .from("hospital_pages")
      .select("id, admin_email, hospital_id")
      .eq("id", clinicId)
      .maybeSingle();

    if (!clinicPage) {
      return new Response(
        JSON.stringify({ success: false, error: "Clinic not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const isAdminEmail =
      clinicPage.admin_email?.toLowerCase() === user.email?.toLowerCase();
    if (!isAdminEmail) {
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // ── Resolve clinic name for email footer ──────────────────
    let clinicName = "ClinicalHours Clinic";
    if (clinicPage.hospital_id) {
      const { data: opp } = await supabaseAdmin
        .from("opportunities")
        .select("name")
        .eq("id", clinicPage.hospital_id)
        .single();
      if (opp?.name) clinicName = opp.name;
    }

    // ── Send emails ───────────────────────────────────────────
    const validRecipients = recipients.filter(
      (r) => r.email?.trim()?.includes("@"),
    );
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
      const batch = validRecipients.slice(i, i + BATCH_SIZE);

      for (const recipient of batch) {
        // Build per-recipient variable map
        const vars: Record<string, string> = {
          name: recipient.name || "Team Member",
          role: recipient.role || "",
          ...globalVariables,
        };

        const renderedSubject = renderTemplate(subjectTemplate, vars);
        const renderedBody = renderTemplate(bodyTemplate, vars);
        const emailHtml = buildEmailHtml(renderedBody, clinicName);

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: [recipient.email.trim()],
              subject: renderedSubject,
              html: emailHtml,
            }),
          });

          if (emailResponse.ok) {
            sent++;
          } else {
            failed++;
            const errData = (await emailResponse
              .json()
              .catch(() => ({}))) as Record<string, string>;
            console.error(
              "Resend API error for",
              recipient.email,
              JSON.stringify(errData),
            );
            if (errors.length < 5) {
              errors.push(
                `${recipient.email}: ${errData?.message || errData?.error || "Failed"}`,
              );
            }
          }
        } catch (err) {
          failed++;
          console.error("Error sending to", recipient.email, err);
          if (errors.length < 5) {
            errors.push(
              `${recipient.email}: ${err instanceof Error ? err.message : "Failed"}`,
            );
          }
        }

        // Small delay between sends to stay under Resend rate limits
        await new Promise((r) => setTimeout(r, 80));
      }

      // Longer pause between batches
      if (i + BATCH_SIZE < validRecipients.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // ── Determine log status ──────────────────────────────────
    let logStatus = "sent";
    if (sent === 0 && failed > 0) logStatus = "failed";
    else if (sent > 0 && failed > 0) logStatus = "partial";

    // ── Persist send log ──────────────────────────────────────
    const { error: logError } = await supabaseAdmin
      .from("email_send_logs")
      .insert({
        clinic_id: clinicId,
        template_id: templateId || null,
        template_name: templateName || null,
        subject: subjectTemplate.trim(),
        recipient_count: sent,
        recipient_emails: validRecipients.map((r) => r.email),
        sent_by: user.email!,
        status: logStatus,
        metadata: {
          total: validRecipients.length,
          sent,
          failed,
          errors: errors.length > 0 ? errors : undefined,
        },
      });

    if (logError) {
      console.error("Failed to log email send:", logError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: validRecipients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: unknown) {
    console.error("send-clinic-bulk-email error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send emails",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
