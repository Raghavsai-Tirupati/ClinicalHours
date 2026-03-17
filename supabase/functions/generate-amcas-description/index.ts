import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateOrigin, checkAdminRole } from "../_shared/auth.ts";

interface RequestBody {
  activity_name: string;
  activity_type: string;
  role: string;
  hours_per_week?: number | null;
  total_hours?: number | null;
  is_most_meaningful: boolean;
  user_notes: string;
}

const SYSTEM_PROMPT = `You are an expert AMCAS medical school application advisor. Write a Work & Activities description for a pre-med student. Rules:
- MUST be under 700 characters including spaces
- Use first person
- Be specific and action-oriented, not generic
- Highlight impact, skills gained, and personal growth
- If marked as Most Meaningful, make the description reflect deeper personal significance and transformation
- Do NOT use clichés like 'passion for medicine' or 'helping others'
- Do NOT start with 'I' — vary sentence structure
- Write in a mature, reflective tone appropriate for medical school admissions
- Return ONLY the description text, nothing else`;

async function callAnthropic(apiKey: string, userMessage: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() ?? "";
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(JSON.stringify({ error: "Invalid origin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Require authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin (always allowed)
    const { isAdmin } = await checkAdminRole(user.id);

    // Check premium status from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading profile for AMCAS description:", profileError);
      return new Response(JSON.stringify({ error: "Failed to load profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const expiresAt = profile?.premium_expires_at ? new Date(profile.premium_expires_at as string) : null;
    const isPremiumActive =
      !!profile?.is_premium && (!expiresAt || expiresAt.getTime() > now.getTime());

    if (!isAdmin && !isPremiumActive) {
      return new Response(JSON.stringify({ error: "Premium subscription required for this feature." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();

    const userMessage = `Activity: ${body.activity_name}
Type: ${body.activity_type}
Role: ${body.role}
Hours/week: ${body.hours_per_week ?? "Not provided"}
Total hours: ${body.total_hours ?? "Not provided"}
Most Meaningful: ${body.is_most_meaningful ? "Yes" : "No"}
Notes from student: ${body.user_notes || "None provided"}`;

    let description = await callAnthropic(apiKey, userMessage);
    let charCount = description.length;

    if (charCount > 700) {
      const shortenMessage = `The following AMCAS activity description is ${charCount} characters but MUST be under 700 characters. Shorten it while preserving the key content. Return ONLY the shortened text:\n\n${description}`;
      description = await callAnthropic(apiKey, shortenMessage);
      charCount = description.length;
    }

    return new Response(JSON.stringify({ description, char_count: charCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-amcas-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
