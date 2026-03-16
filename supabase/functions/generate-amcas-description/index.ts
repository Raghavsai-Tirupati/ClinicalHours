import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  activity_name: string;
  activity_type: string;
  role: string;
  hours_per_week: number;
  total_hours: number;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body: RequestBody = await req.json();

    const userMessage = `Activity: ${body.activity_name}
Type: ${body.activity_type}
Role: ${body.role}
Hours/week: ${body.hours_per_week}
Total hours: ${body.total_hours}
Most Meaningful: ${body.is_most_meaningful ? "Yes" : "No"}
Notes from student: ${body.user_notes || "None provided"}`;

    let description = await callAnthropic(apiKey, userMessage);
    let charCount = description.length;

    // If over 700 chars, ask to shorten
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
