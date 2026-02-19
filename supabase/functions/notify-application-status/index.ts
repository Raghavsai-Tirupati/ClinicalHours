import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(JSON.stringify({ error: "Invalid origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { application_id, status } = await req.json();

    if (!["accepted", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is an owner/admin for this application's hospital
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the application row
    const { data: app, error: appErr } = await supabaseAdmin
      .from("hospital_applications")
      .select("id, account_id, student_id, applicant_email, applicant_name, status")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify the caller is an owner/admin of the hospital that owns this application
    const { data: member } = await supabaseAdmin
      .from("hospital_members")
      .select("role")
      .eq("account_id", app.account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch hospital name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: accountData } = await supabaseAdmin
      .from("hospital_accounts")
      .select("hospitals(name)")
      .eq("id", app.account_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hospitalName = escapeHtml((accountData?.hospitals as any)?.name ?? "the hospital");

    // Resolve applicant email + name
    let recipientEmail: string | null = null;
    let recipientName = "Student";

    if (app.student_id) {
      // Authenticated applicant — look up via admin API
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(app.student_id);
      recipientEmail = userData?.user?.email ?? null;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", app.student_id)
        .maybeSingle();
      if (profile?.full_name) recipientName = profile.full_name;
    } else {
      // Guest applicant
      recipientEmail = app.applicant_email ?? null;
      recipientName = app.applicant_name ?? "Student";
    }

    if (!recipientEmail) {
      // No email to send to — succeed silently
      return new Response(JSON.stringify({ success: true, skipped: "no_email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const safeName = escapeHtml(recipientName);
    const isAccepted = status === "accepted";

    const subject = isAccepted
      ? `🎉 Congratulations! Your application to ${hospitalName} was accepted`
      : `Application update from ${hospitalName}`;

    const html = isAccepted
      ? `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#22c55e;margin-bottom:8px;">Congratulations, ${safeName}!</h1>
          <p style="font-size:16px;color:#374151;">
            Your volunteer application to <strong>${hospitalName}</strong> has been
            <strong style="color:#22c55e;">accepted</strong>!
          </p>
          <p style="color:#6b7280;">
            The team at ${hospitalName} will be in touch with next steps. Keep an eye on your inbox.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:13px;">
            Best of luck in your clinical journey,<br/>The ClinicalHours Team
          </p>
        </div>`
      : `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#4F46E5;margin-bottom:8px;">Application Update</h1>
          <p style="font-size:16px;color:#374151;">Hi ${safeName},</p>
          <p style="color:#374151;">
            Thank you for applying to <strong>${hospitalName}</strong>. After reviewing your
            application, the team has decided not to move forward at this time.
          </p>
          <p style="color:#6b7280;">
            Don't be discouraged — there are many other opportunities on ClinicalHours.
            Keep exploring and best of luck!
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:13px;">The ClinicalHours Team</p>
        </div>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClinicalHours <support@clinicalhours.org>",
        to: [recipientEmail],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: unknown) {
    console.error("notify-application-status error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
