import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGmailAccessToken } from "../_shared/gmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AUTORESPONDER_SECRET = Deno.env.get("BCS_AUTORESPONDER_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const BCS_STAFF_NOTIFY_EMAIL = "admin@bcsclinic.org";
const BCS_GMAIL_EMAIL = "admin@bcsclinic.org";
const CLINICALHOURS_URL = "https://clinicalhours.org";
const BCS_APPLY_URL = "https://clinicalhours.org/opportunities/bcs-free-health-clinic";

const HIGH_CONFIDENCE_PATTERNS = [
  /how (do i|can i|to) apply/i,
  /how (do i|can i|to) (get involved|volunteer)/i,
  /interested in (volunteering|applying|a position|the position|an opening)/i,
  /looking to (volunteer|apply|join|get involved)/i,
  /looking for (a position|an opening|volunteer|opportunities)/i,
  /want to (volunteer|apply|join|get involved)/i,
  /would like to (volunteer|apply|join|get involved)/i,
  /apply(ing)? (for|to)/i,
  /volunteer (position|opportunity|opening|application|role)/i,
  /clinical (volunteer|hours|position|opportunity)/i,
  /pre-?med.*volunteer/i,
  /pre-?health.*volunteer/i,
  /shadow(ing)? (opportunity|position|program)/i,
  /internship (application|opportunity|opening|position)/i,
  /available (position|opening|volunteer)/i,
  /open (position|volunteer|application)/i,
];

const WEAK_PATTERNS = [
  /\bvolunteer\b/i, /\bapplication\b/i, /\bposition\b/i, /\bopening\b/i,
  /\bopportunity\b/i, /\binternship\b/i, /\bshadow\b/i, /\bshadowing\b/i,
  /\bhiring\b/i, /\bjoin\b/i, /\bemployment\b/i, /\bjob\b/i, /\bstaff\b/i,
  /pre-?med\b/i, /pre-?health\b/i, /get involved/i,
];

function classifyEmail(subject: string, snippet: string): "job_inquiry" | "general" {
  const text = `${subject} ${snippet}`;
  if (HIGH_CONFIDENCE_PATTERNS.some((re) => re.test(text))) return "job_inquiry";
  const weakMatches = WEAK_PATTERNS.filter((re) => re.test(text)).length;
  return weakMatches >= 2 ? "job_inquiry" : "general";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildJobInquiryHtml(senderName: string): string {
  const name = escapeHtml(senderName || "there");
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
    <h2 style="margin:0 0 8px;">BCS Free Health Clinic</h2>
    <p><strong>Thanks for your interest in volunteering!</strong></p>
    <p>Hi ${name},</p>
    <p>We appreciate you reaching out. BCS Free Health Clinic manages all volunteer and clinical positions through <strong>ClinicalHours</strong>, a platform built specifically for pre-health students looking for hands-on clinical experience.</p>
    <p>You can view our open positions and apply directly here:</p>
    <p><a href="${BCS_APPLY_URL}" style="display:inline-block;padding:10px 16px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Apply to BCS Free Health Clinic</a></p>
    <p>Through ClinicalHours you can:</p>
    <ul>
      <li>See all current openings at BCS and apply in one place</li>
      <li>Track your application status after submitting</li>
      <li>Log your volunteer hours and build your clinical record</li>
    </ul>
    <p>Best,<br/>BCS Free Health Clinic Team</p>
    <hr/>
    <p style="color:#666;font-size:12px;">This is an automated response. A member of our team will follow up if needed.</p>
    <p style="color:#666;font-size:12px;">Not what you were emailing about? If we misread your message, just reply here and our team will follow up directly.</p>
  </body>
</html>`;
}

function buildGeneralContactHtml(senderName: string): string {
  const name = escapeHtml(senderName || "there");
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
    <h2 style="margin:0 0 8px;">BCS Free Health Clinic</h2>
    <p><strong>We got your message.</strong></p>
    <p>Hi ${name},</p>
    <p>Thanks for reaching out to BCS Free Health Clinic. We received your email and a member of our team will get back to you as soon as possible, typically within 2 to 3 business days.</p>
    <p>In the meantime, here are a few resources that may help:</p>
    <ul>
      <li>Looking for a volunteer or clinical position? Visit <a href="${CLINICALHOURS_URL}">ClinicalHours</a> to see our open positions and apply directly.</li>
      <li>General clinic information: Reply to this email or call our front desk.</li>
    </ul>
    <p>Best,<br/>BCS Free Health Clinic Team</p>
    <hr/>
    <p style="color:#666;font-size:12px;">This is an automated acknowledgment. Our team will follow up personally.</p>
  </body>
</html>`;
}

function buildStaffNotificationHtml(senderName: string, senderEmail: string, subject: string, snippet: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
    <h3>New general contact email — action required</h3>
    <table cellpadding="6" style="border-collapse:collapse;">
      <tr><td><strong>From</strong></td><td>${escapeHtml(senderName)} &lt;${escapeHtml(senderEmail)}&gt;</td></tr>
      <tr><td><strong>Subject</strong></td><td>${escapeHtml(subject)}</td></tr>
      <tr><td><strong>Preview</strong></td><td>${escapeHtml(snippet)}</td></tr>
    </table>
    <p>An automated acknowledgment was sent to the sender. Please reply to ${escapeHtml(senderEmail)} directly.</p>
  </body>
</html>`;
}

interface GmailMessageHeader { name: string; value: string; }
interface GmailMessage {
  id: string; threadId: string; snippet: string;
  payload?: { headers?: GmailMessageHeader[]; };
}

function getHeader(headers: GmailMessageHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gmailRequest(accessToken: string, path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
}

async function listUnreadMessages(accessToken: string): Promise<{ id: string; threadId: string }[]> {
  const res = await gmailRequest(accessToken, `/messages?q=is:unread in:inbox&maxResults=20`);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Gmail list failed (${res.status}): ${JSON.stringify(err)}`); }
  const data = await res.json();
  return (data.messages ?? []) as { id: string; threadId: string }[];
}

async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const res = await gmailRequest(accessToken, `/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID`);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Gmail get message failed (${res.status}): ${JSON.stringify(err)}`); }
  return res.json();
}

async function sendReply(accessToken: string, threadId: string, inReplyToMessageId: string, toEmail: string, fromEmail: string, subject: string, html: string): Promise<void> {
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const rawEmail = [`From: BCS Free Health Clinic <${fromEmail}>`, `To: ${toEmail}`, `Subject: ${replySubject}`, `In-Reply-To: ${inReplyToMessageId}`, `References: ${inReplyToMessageId}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, html].join("\r\n");
  const res = await gmailRequest(accessToken, `/messages/send`, { method: "POST", body: JSON.stringify({ raw: base64urlEncode(rawEmail), threadId }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Gmail send reply failed (${res.status}): ${JSON.stringify((err as { error?: { message?: string } })?.error?.message ?? err)}`); }
}

async function markAsRead(accessToken: string, messageId: string): Promise<void> {
  const res = await gmailRequest(accessToken, `/messages/${messageId}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); console.error(`Failed to mark message ${messageId} as read:`, err); }
}

async function notifyStaffViaResend(senderName: string, senderEmail: string, subject: string, snippet: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ClinicalHours <noreply@clinicalhours.org>", to: [BCS_STAFF_NOTIFY_EMAIL], reply_to: senderEmail, subject: `[BCS Inbox] ${subject || "(no subject)"}`, html: buildStaffNotificationHtml(senderName, senderEmail, subject, snippet) }),
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const callerSecret = req.headers.get("x-autoresponder-secret");
  if (!AUTORESPONDER_SECRET || callerSecret !== AUTORESPONDER_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: page, error: pageError } = await supabase.from("hospital_pages").select("gmail_refresh_token, gmail_email").eq("gmail_email", BCS_GMAIL_EMAIL).maybeSingle();
    if (pageError || !page?.gmail_refresh_token) {
      console.error("BCS Gmail credentials not found:", pageError?.message);
      return new Response(JSON.stringify({ error: "BCS Gmail credentials not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const accessToken = await refreshGmailAccessToken(page.gmail_refresh_token);
    const messages = await listUnreadMessages(accessToken);
    if (messages.length === 0) return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
    let processed = 0;
    let skipped = 0;
    for (const { id: messageId, threadId } of messages) {
      const { data: existing } = await supabase.from("bcs_autoresponder_log").select("id").eq("gmail_message_id", messageId).maybeSingle();
      if (existing) { skipped++; continue; }
      let message: GmailMessage;
      try { message = await getMessage(accessToken, messageId); }
      catch (err) { console.error(`Failed to fetch message ${messageId}:`, err); continue; }
      const headers = message.payload?.headers ?? [];
      const fromHeader = getHeader(headers, "From");
      const subject = getHeader(headers, "Subject");
      const gmailMessageId = getHeader(headers, "Message-ID");
      const snippet = message.snippet ?? "";
      if (fromHeader.includes(BCS_GMAIL_EMAIL)) { await markAsRead(accessToken, messageId); skipped++; continue; }
      const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/(\S+@\S+)/);
      const senderEmail = emailMatch?.[1] ?? fromHeader.trim();
      const nameMatch = fromHeader.match(/^([^<]+)</);
      const senderName = nameMatch?.[1]?.trim() ?? senderEmail.split("@")[0];
      const category = classifyEmail(subject, snippet);
      try {
        const replyHtml = category === "job_inquiry" ? buildJobInquiryHtml(senderName) : buildGeneralContactHtml(senderName);
        await sendReply(accessToken, threadId, gmailMessageId || `<${messageId}>`, senderEmail, BCS_GMAIL_EMAIL, subject, replyHtml);
        if (category === "general") await notifyStaffViaResend(senderName, senderEmail, subject, snippet);
        await markAsRead(accessToken, messageId);
        await supabase.from("bcs_autoresponder_log").insert({ gmail_message_id: messageId, sender_email: senderEmail, subject: subject || null, category });
        processed++;
      } catch (err) { console.error(`Failed to process message ${messageId}:`, err); }
    }
    return new Response(JSON.stringify({ processed, skipped }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("bcs-email-autoresponder error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

serve(handler);
