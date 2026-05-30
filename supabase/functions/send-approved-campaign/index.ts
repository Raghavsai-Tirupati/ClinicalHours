import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Sends a single approved campaign_message via Resend.
// The message must already be in 'approved' or 'queued' state.
// Updates status to 'sent' or 'failed' in place.

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Auth check — admin only
  const authHeader = req.headers.get("Authorization");
  const adminCheck = await checkAdminRole(authHeader, supabase);
  if (!adminCheck.isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { message_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { message_id } = body;
  if (!message_id) {
    return new Response(JSON.stringify({ error: "message_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch message
  const { data: msg, error: fetchErr } = await supabase
    .from("campaign_messages")
    .select("*")
    .eq("id", message_id)
    .single();

  if (fetchErr || !msg) {
    return new Response(JSON.stringify({ error: "Message not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!["approved", "queued"].includes(msg.status)) {
    return new Response(JSON.stringify({ error: `Message is in '${msg.status}' state — must be approved or queued to send` }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Send via Resend
  const resendPayload = {
    from: "ClinicalHours <noreply@clinicalhours.com>",
    to: [msg.recipient_email],
    subject: msg.subject,
    html: msg.body_html,
  };

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    await supabase
      .from("campaign_messages")
      .update({ status: "failed", send_error: errText, updated_at: new Date().toISOString() })
      .eq("id", message_id);

    return new Response(JSON.stringify({ error: "Send failed", detail: errText }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("campaign_messages")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", message_id);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

serve(handler);
