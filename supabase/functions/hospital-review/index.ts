import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ReviewRequest {
  hospitalId: string;
  action: "approve" | "reject";
  note?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendApprovalEmail(
  to: string,
  hospitalName: string,
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClinicalHours <noreply@clinicalhours.org>",
      to: [to],
      subject: "Your ClinicalHours Hospital Account Has Been Approved",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">Welcome to ClinicalHours, ${escapeHtml(hospitalName)}!</h2>
          <p style="color:#444;">Your hospital account has been approved. You can now log in and manage your clinical volunteer opportunities.</p>
          <p style="margin:24px 0;">
            <a href="https://clinicalhours.org/auth"
               style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Log In to Your Dashboard
            </a>
          </p>
          <p style="color:#666;font-size:14px;">
            If you have any questions, contact us at
            <a href="mailto:support@clinicalhours.org" style="color:#2563eb;">support@clinicalhours.org</a>.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend approval email failed:", body);
  }
}

async function sendRejectionEmail(
  to: string,
  hospitalName: string,
  note: string | undefined,
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return;
  }
  const noteHtml = note
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:16px 0;">
         <p style="margin:0;font-weight:600;color:#dc2626;">Admin Note:</p>
         <p style="margin:4px 0 0;color:#444;">${escapeHtml(note)}</p>
       </div>`
    : "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClinicalHours <noreply@clinicalhours.org>",
      to: [to],
      subject: "Update on Your ClinicalHours Hospital Account Application",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">Application Update for ${escapeHtml(hospitalName)}</h2>
          <p style="color:#444;">
            Thank you for applying to join ClinicalHours. After reviewing your application,
            we are unable to approve your hospital account at this time.
          </p>
          ${noteHtml}
          <p style="color:#666;font-size:14px;">
            If you believe this was an error or have questions, please contact us at
            <a href="mailto:support@clinicalhours.org" style="color:#2563eb;">support@clinicalhours.org</a>.
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend rejection email failed:", body);
  }
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
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { isAdmin, error: adminError } = await checkAdminRole(user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: adminError || "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let payload: ReviewRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { hospitalId, action, note } = payload;

    if (!hospitalId || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "hospitalId and action (approve|reject) are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Fetch the hospital account - support both schemas:
    // 1) Ecosystem: hospital_id FK -> hospitals(name)
    // 2) Verification (20260223): hospital_name column, no hospitals FK
    let row: { id?: string; contact_email?: string; account_status?: string; hospital_name?: string; hospitals?: { name?: string } | null } | null = null;
    let fetchError: { message?: string; code?: string } | null = null;

    const { data: rowWithJoin, error: errJoin } = await supabaseAdmin
      .from("hospital_accounts")
      .select("id, contact_email, account_status, hospitals(name)")
      .eq("id", hospitalId)
      .single();

    if (!errJoin && rowWithJoin) {
      // .single() with a join returns hospitals as object, but TS infers array.
      // Normalize to the expected shape.
      const h = rowWithJoin.hospitals;
      const hospitalObj = Array.isArray(h) ? h[0] ?? null : h;
      row = { ...rowWithJoin, hospitals: hospitalObj } as unknown as typeof row;
    } else {
      // Fallback: no hospitals FK (20260223 schema) - select hospital_name if it exists
      const { data: rowDirect, error: errDirect } = await supabaseAdmin
        .from("hospital_accounts")
        .select("id, contact_email, account_status, hospital_name")
        .eq("id", hospitalId)
        .single();
      if (!errDirect && rowDirect) row = rowDirect;
      else fetchError = errDirect ?? errJoin;
    }

    if (!row) {
      return new Response(
        JSON.stringify({ success: false, error: "Hospital account not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const hospitalName = row.hospital_name ?? (row.hospitals as { name?: string } | null)?.name ?? "Hospital";
    const contactEmail = row.contact_email ?? "";

    // Update the hospital account
    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: updateError } = await supabaseAdmin
      .from("hospital_accounts")
      .update({
        account_status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_note: note ?? null,
      })
      .eq("id", hospitalId);

    if (updateError) {
      console.error("Error updating hospital account:", updateError);
      throw new Error("Failed to update hospital account");
    }

    // Send email (non-blocking — don't fail the request if email fails)
    if (contactEmail) {
      if (action === "approve") {
        await sendApprovalEmail(contactEmail, hospitalName);
      } else {
        await sendRejectionEmail(contactEmail, hospitalName, note);
      }
    }

    return new Response(
      JSON.stringify({ success: true, action, hospitalId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error in hospital-review:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
