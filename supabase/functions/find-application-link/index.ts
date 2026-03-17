import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Rate limit: max 10 LIVE searches per user per 5 minutes.
// Cached results do NOT count against this limit.
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

// ── DB cache helpers ──────────────────────────────────────────────────────────

const CACHE_TTL_DAYS = 30;      // fresh result — reuse for 30 days
const NO_RESULT_TTL_DAYS = 7;   // negative cache — retry after 7 days

// deno-lint-ignore no-explicit-any
type DbClient = any;

interface CacheRow {
  application_url: string | null;
  confidence: string | null;
  search_query: string | null;
  last_searched_at: string;
}

/**
 * Returns cached rows if they exist and are still fresh, else null.
 * "Fresh" means within CACHE_TTL_DAYS for hits, NO_RESULT_TTL_DAYS for misses.
 */
async function getCached(db: DbClient, nameLower: string): Promise<CacheRow[] | null> {
  const { data, error } = await db
    .from("application_links")
    .select("application_url, confidence, search_query, last_searched_at")
    .eq("hospital_name_lower", nameLower)
    .order("last_searched_at", { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) return null;

  const newest = new Date(data[0].last_searched_at);
  const ageMs = Date.now() - newest.getTime();

  // Determine TTL based on whether we have real results or a negative cache entry
  const hasResults = data.some((r: CacheRow) => r.application_url !== null);
  const ttlMs = hasResults
    ? CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
    : NO_RESULT_TTL_DAYS * 24 * 60 * 60 * 1000;

  if (ageMs > ttlMs) return null; // stale — trigger fresh search

  return data as CacheRow[];
}

/**
 * Stores search results (or a negative cache entry) into application_links.
 * Deletes old rows for this hospital first to avoid unbounded growth.
 */
async function storeResults(
  db: DbClient,
  hospitalName: string,
  websiteHint: string | null,
  links: LinkResult[],
): Promise<void> {
  // Remove stale rows for this hospital
  await db
    .from("application_links")
    .delete()
    .eq("hospital_name_lower", hospitalName.toLowerCase());

  const now = new Date().toISOString();

  if (links.length === 0) {
    // Negative cache — store a single null-URL row so we don't keep re-searching
    await db.from("application_links").insert({
      hospital_name: hospitalName,
      hospital_website: websiteHint,
      application_url: null,
      confidence: null,
      search_query: null,
      last_searched_at: now,
      updated_at: now,
    });
    return;
  }

  const rows = links.map((l) => ({
    hospital_name: hospitalName,
    hospital_website: websiteHint,
    application_url: l.url,
    confidence: l.confidence,
    search_query: l.label,
    last_searched_at: now,
    updated_at: now,
  }));

  await db.from("application_links").insert(rows);
}

// ── Approach 1: Probe common volunteer/application URL patterns ───────────────
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

  const probes = VOLUNTEER_PATHS.map(async (path): Promise<LinkResult | null> => {
    const fullUrl = `${origin}${path}`;
    try {
      const res = await fetch(fullUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "ClinicalHours-Bot/1.0" },
      });
      if (res.ok) {
        return {
          url: res.url || fullUrl,
          confidence: pathConfidence(path),
          label: `Volunteer Page (${path})`,
        };
      }
    } catch { /* timeout or network error — skip */ }
    return null;
  });

  const settled = await Promise.allSettled(probes);
  return settled
    .filter((r): r is PromiseFulfilledResult<LinkResult> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
}

// ── Approach 2: Serper.dev — real Google results (optional) ──────────────────
// Sign up free at serper.dev (2 500 free queries). Set secret: SERPER_API_KEY
async function serperSearch(query: string): Promise<LinkResult[]> {
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.organic ?? []).map((item: { link?: string; title?: string; snippet?: string }) => {
      const url = item.link ?? "";
      if (!url) return null;

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

      return { url, confidence, label: item.title ?? url, note: (item.snippet as string | undefined)?.slice(0, 120) } satisfies LinkResult;
    }).filter(Boolean) as LinkResult[];
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
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
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Parse body
    const body = await req.json();
    const { organizationName, websiteHint } = body;

    if (!organizationName || typeof organizationName !== "string" || organizationName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "organizationName is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const name = organizationName.trim().slice(0, 200);
    const nameLower = name.toLowerCase();
    const hint = typeof websiteHint === "string" && websiteHint ? websiteHint : null;

    // ── 1. Check DB cache ──────────────────────────────────────────────────
    const cached = await getCached(db, nameLower);
    if (cached !== null) {
      // Build LinkResult array from cached rows (null URL = negative cache)
      const links: LinkResult[] = cached
        .filter((r) => r.application_url !== null)
        .map((r) => ({
          url: r.application_url as string,
          confidence: (r.confidence ?? "low") as "high" | "medium" | "low",
          label: r.search_query ?? r.application_url as string,
        }));

      console.log(`Cache hit for "${name}" — ${links.length} link(s)`);

      return new Response(
        JSON.stringify({
          organizationName: name,
          links,
          searchedAt: cached[0].last_searched_at,
          cached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── 2. Cache miss — enforce rate limit before live search ──────────────
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before searching again." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // ── 3. Live search (probe + serper) ────────────────────────────────────
    const [probeResults, serperResults] = await Promise.all([
      hint ? probeVolunteerUrls(hint) : Promise.resolve([]),
      serperSearch(`${name} volunteer application`),
    ]);

    // Merge & deduplicate by normalised URL
    const seenUrls = new Set<string>();
    const links: LinkResult[] = [];
    for (const r of [...probeResults, ...serperResults]) {
      const key = r.url.replace(/\/$/, "").toLowerCase();
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        links.push(r);
        if (links.length >= 6) break;
      }
    }

    // Sort: high → medium → low
    const order = { high: 0, medium: 1, low: 2 };
    links.sort((a, b) => order[a.confidence] - order[b.confidence]);

    // ── 4. Persist results (fire-and-forget — don't block the response) ────
    storeResults(db, name, hint, links).catch((e) =>
      console.error("Failed to cache application_links:", e)
    );

    return new Response(
      JSON.stringify({
        organizationName: name,
        links,
        searchedAt: new Date().toISOString(),
        cached: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("find-application-link error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
