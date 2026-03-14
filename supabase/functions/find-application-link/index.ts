import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Rate limit: max 10 requests per user per 5 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

interface LinkResult {
  url: string;
  confidence: "high" | "medium" | "low";
  label: string;
  note?: string;
}

// ── Approach 1: Probe common volunteer/application URL patterns ──────────────
// Works immediately with zero API keys — uses the hospital's known website URL.
const VOLUNTEER_PATHS = [
  "/volunteer",
  "/volunteers",
  "/volunteer-services",
  "/volunteer-opportunities",
  "/volunteering",
  "/volunteer-application",
  "/community/volunteer",
  "/community/volunteers",
  "/community/volunteer-services",
  "/giving/volunteer",
  "/about/volunteer",
  "/get-involved/volunteer",
  "/get-involved",
  "/shadow",
  "/shadowing",
  "/clinical-shadowing",
  "/for-volunteers",
  "/departments/volunteer-services",
];

// Higher confidence for paths that include "application" or "apply"
function pathConfidence(path: string): "high" | "medium" {
  const high = ["application", "apply", "shadow", "clinical"];
  return high.some((s) => path.includes(s)) ? "high" : "medium";
}

async function probeVolunteerUrls(websiteHint: string): Promise<LinkResult[]> {
  let origin: string;
  try {
    origin = new URL(websiteHint).origin;
  } catch {
    return [];
  }

  const results: LinkResult[] = [];
  const TIMEOUT_MS = 4000;

  // Run all probes in parallel
  const probes = VOLUNTEER_PATHS.map(async (path): Promise<LinkResult | null> => {
    const fullUrl = `${origin}${path}`;
    try {
      const res = await fetch(fullUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "ClinicalHours-Bot/1.0" },
      });
      if (res.ok) {
        const finalUrl = res.url || fullUrl;
        return {
          url: finalUrl,
          confidence: pathConfidence(path),
          label: `Volunteer Page (${path})`,
        };
      }
    } catch {
      // Timeout or network error — skip
    }
    return null;
  });

  const settled = await Promise.allSettled(probes);
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) {
      results.push(r.value);
    }
  }

  return results;
}

// ── Approach 2: Serper.dev — real Google search results (optional) ───────────
// Sign up free at serper.dev (2500 free queries). Set secret: SERPER_API_KEY
async function serperSearch(query: string): Promise<LinkResult[]> {
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();

    const results: LinkResult[] = [];
    for (const item of data.organic ?? []) {
      const url: string = item.link ?? "";
      if (!url) continue;

      const urlLower = url.toLowerCase();
      const titleLower = (item.title ?? "").toLowerCase();
      const snippetLower = (item.snippet ?? "").toLowerCase();

      const highSignals = ["apply", "application", "volunteer", "signup", "sign-up", "register", "form", "shadow"];
      const medSignals = ["volunteer", "opportunity", "join", "community", "program", "clinical"];

      const isHighUrl = highSignals.some((s) => urlLower.includes(s));
      const isHighTitle = highSignals.some((s) => titleLower.includes(s) || snippetLower.includes(s));

      let confidence: "high" | "medium" | "low" = "low";
      if (isHighUrl && isHighTitle) confidence = "high";
      else if (isHighUrl || isHighTitle) confidence = "medium";
      else if (medSignals.some((s) => titleLower.includes(s) || urlLower.includes(s))) confidence = "medium";

      results.push({
        url,
        confidence,
        label: item.title ?? url,
        note: item.snippet ? (item.snippet as string).slice(0, 120) : undefined,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before searching again." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    const { organizationName, websiteHint } = body;

    if (!organizationName || typeof organizationName !== "string" || organizationName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "organizationName is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const name = organizationName.trim().slice(0, 200);

    // Run both approaches concurrently
    const [probeResults, serperResults] = await Promise.all([
      websiteHint ? probeVolunteerUrls(websiteHint) : Promise.resolve([]),
      serperSearch(`${name} volunteer application`),
    ]);

    // Merge, deduplicate by URL
    const seenUrls = new Set<string>();
    const links: LinkResult[] = [];

    for (const r of [...probeResults, ...serperResults]) {
      const normalized = r.url.replace(/\/$/, "").toLowerCase();
      if (!seenUrls.has(normalized)) {
        seenUrls.add(normalized);
        links.push(r);
        if (links.length >= 6) break;
      }
    }

    // Sort: high → medium → low
    const order = { high: 0, medium: 1, low: 2 };
    links.sort((a, b) => order[a.confidence] - order[b.confidence]);

    return new Response(
      JSON.stringify({ organizationName: name, links, searchedAt: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (err) {
    console.error("find-application-link error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
