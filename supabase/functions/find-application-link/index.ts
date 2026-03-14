import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Simple in-memory rate limit: max 10 requests per user per 5 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
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
    // Authenticate via Bearer token (sent automatically by supabase.functions.invoke)
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

    // Rate limit check
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

    // Extract domain from websiteHint (e.g. "https://www.foo.org" → "foo.org")
    let siteDomain: string | null = null;
    if (websiteHint && typeof websiteHint === "string") {
      try {
        const url = new URL(websiteHint);
        siteDomain = url.hostname.replace(/^www\./, "");
      } catch { /* ignore malformed URLs */ }
    }

    const GOOGLE_CSE_API_KEY = Deno.env.get("GOOGLE_CSE_API_KEY");
    const GOOGLE_CSE_ID = Deno.env.get("GOOGLE_CSE_ID");

    if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
      return new Response(
        JSON.stringify({ error: "Search service not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID secrets." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build queries — site-scoped first if we have a domain hint
    const queries: string[] = [];
    if (siteDomain) {
      queries.push(`site:${siteDomain} volunteer OR shadow OR apply`);
    }
    queries.push(
      `${name} volunteer application form`,
      `${name} shadowing application`,
      `${name} clinical volunteer apply`,
    );

    const seenUrls = new Set<string>();
    const links: Array<{ url: string; confidence: "high" | "medium" | "low"; label: string; note?: string }> = [];

    for (const q of queries) {
      if (links.length >= 5) break;

      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(q)}&num=3`;
        const res = await fetch(searchUrl);
        if (!res.ok) continue;
        const data = await res.json();

        for (const item of data.items ?? []) {
          if (links.length >= 5) break;
          const url: string = item.link;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);

          const urlLower = url.toLowerCase();
          const titleLower = (item.title ?? "").toLowerCase();
          const snippetLower = (item.snippet ?? "").toLowerCase();

          let confidence: "high" | "medium" | "low" = "low";
          const highSignals = ["apply", "application", "volunteer", "signup", "sign-up", "register", "form"];
          const medSignals = ["volunteer", "opportunity", "join", "community", "program"];

          const isHighUrl = highSignals.some((s) => urlLower.includes(s));
          const isHighTitle = highSignals.some((s) => titleLower.includes(s) || snippetLower.includes(s));

          if (isHighUrl && isHighTitle) confidence = "high";
          else if (isHighUrl || isHighTitle) confidence = "medium";
          else if (medSignals.some((s) => titleLower.includes(s) || urlLower.includes(s))) confidence = "medium";

          links.push({
            url,
            confidence,
            label: item.title ?? url,
            note: item.snippet ? item.snippet.slice(0, 120) : undefined,
          });
        }
      } catch {
        // Ignore per-query errors, continue with next query
      }
    }

    // Sort: high first, then medium, then low
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
