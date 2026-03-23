import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Verify Calendly webhook signature (HMAC-SHA256). */
async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Parse "t=<timestamp>,v1=<hash>"
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [key, ...rest] = segment.split("=");
    if (key && rest.length) parts[key.trim()] = rest.join("=").trim();
  }

  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  // Replay protection: reject if timestamp is > 5 minutes old
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    console.warn("[calendly-webhook] Timestamp too old, possible replay:", { ts, now });
    return false;
  }

  // HMAC-SHA256: sign "timestamp.rawBody"
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === v1;
}

/** Normalize a URL for fuzzy matching: lowercase, strip trailing slash & protocol. */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  // ── Signature verification ──
  const signingKey = Deno.env.get("CALENDLY_WEBHOOK_SIGNING_KEY");
  const signatureHeader = req.headers.get("Calendly-Webhook-Signature");

  if (signingKey) {
    const valid = await verifySignature(rawBody, signatureHeader, signingKey);
    if (!valid) {
      console.error("[calendly-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("[calendly-webhook] CALENDLY_WEBHOOK_SIGNING_KEY not set — skipping verification (dev mode)");
  }

  // ── Parse payload ──
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = payload.event as string | undefined;
  if (event !== "invitee.created" && event !== "invitee.canceled") {
    // Not an event we care about — acknowledge
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const inviteeEmail = (payload.payload?.email ?? "").trim().toLowerCase();
  const eventStartTime = payload.payload?.event?.start_time ?? null;
  const schedulingUrl = payload.payload?.event_type?.scheduling_url ?? payload.payload?.event?.event_type ?? "";
  const eventUri = payload.payload?.uri ?? payload.payload?.event?.uri ?? "";

  if (!inviteeEmail) {
    console.warn("[calendly-webhook] No invitee email in payload");
    return new Response(JSON.stringify({ ok: true, warning: "no email" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[calendly-webhook] Processing ${event} for ${inviteeEmail}, schedulingUrl=${schedulingUrl}`);

  // ── Supabase service-role client ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── Find matching hospital page by scheduling URL ──
  const normalizedSchedulingUrl = normalizeUrl(schedulingUrl);

  const { data: allPages, error: pagesError } = await supabase
    .from("hospital_pages")
    .select("id, interview_booking_url")
    .not("interview_booking_url", "is", null);

  if (pagesError) {
    console.error("[calendly-webhook] Error fetching hospital pages:", pagesError);
    return new Response(JSON.stringify({ ok: true, error: "db_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const matchedPage = (allPages ?? []).find((page) => {
    if (!page.interview_booking_url) return false;
    const normalizedStored = normalizeUrl(page.interview_booking_url);
    // Fuzzy match: one contains the other (handles path differences)
    return (
      normalizedSchedulingUrl.includes(normalizedStored) ||
      normalizedStored.includes(normalizedSchedulingUrl)
    );
  });

  if (!matchedPage) {
    console.warn("[calendly-webhook] No hospital page matches schedulingUrl:", schedulingUrl);
    return new Response(JSON.stringify({ ok: true, warning: "no_match" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[calendly-webhook] Matched hospital_page: ${matchedPage.id}`);

  // ── Find matching student applications ──
  // Get position IDs for this hospital page
  const { data: positions, error: posError } = await supabase
    .from("hospital_positions")
    .select("id")
    .eq("hospital_page_id", matchedPage.id);

  if (posError || !positions?.length) {
    console.warn("[calendly-webhook] No positions for matched page");
    return new Response(JSON.stringify({ ok: true, warning: "no_positions" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const positionIds = positions.map((p) => p.id);

  const { data: apps, error: appsError } = await supabase
    .from("student_applications")
    .select("id, status, interview_invited_at, submitted_at, position_id")
    .in("position_id", positionIds)
    .ilike("applicant_email", inviteeEmail)
    .order("submitted_at", { ascending: false });

  if (appsError) {
    console.error("[calendly-webhook] Error fetching applications:", appsError);
    return new Response(JSON.stringify({ ok: true, error: "db_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!apps?.length) {
    console.warn(`[calendly-webhook] No matching applications for email=${inviteeEmail} in page=${matchedPage.id}`);
    return new Response(JSON.stringify({ ok: true, warning: "no_applications" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tie-breaker: prefer the one with interview_invited_at set, then interview status, then most recent
  const target =
    apps.find((a) => a.interview_invited_at && a.status === "interview") ??
    apps.find((a) => a.interview_invited_at) ??
    apps.find((a) => a.status === "interview") ??
    apps[0];

  console.log(`[calendly-webhook] Target application: ${target.id} (status=${target.status})`);

  // ── Apply update ──
  const terminalStatuses = ["accepted", "rejected", "waitlisted"];

  if (event === "invitee.created") {
    const startTime = eventStartTime ? new Date(eventStartTime).toISOString() : null;

    const patch: Record<string, unknown> = {
      interview_confirmed_at: startTime,
      interview_source: "calendly",
    };

    // Auto-advance status if not terminal
    if (!terminalStatuses.includes(target.status) && target.status !== "interview") {
      patch.status = "interview";
    }

    const { error: updateError } = await supabase
      .from("student_applications")
      .update(patch)
      .eq("id", target.id);

    if (updateError) {
      console.error("[calendly-webhook] Update error:", updateError);
      return new Response(JSON.stringify({ ok: true, error: "update_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[calendly-webhook] ✅ Set interview_confirmed_at=${startTime} on application ${target.id}`);
  } else if (event === "invitee.canceled") {
    const patch: Record<string, unknown> = {
      interview_confirmed_at: null,
      interview_source: null,
    };

    // Revert status from interview → under_review if it was interview
    if (target.status === "interview") {
      patch.status = "under_review";
    }

    const { error: updateError } = await supabase
      .from("student_applications")
      .update(patch)
      .eq("id", target.id);

    if (updateError) {
      console.error("[calendly-webhook] Update error:", updateError);
      return new Response(JSON.stringify({ ok: true, error: "update_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[calendly-webhook] ✅ Cleared interview_confirmed_at on application ${target.id}`);
  }

  return new Response(JSON.stringify({ ok: true, applicationId: target.id, event }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
