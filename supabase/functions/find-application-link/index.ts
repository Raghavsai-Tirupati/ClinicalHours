import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

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

// ── Approach 1: Probe common URL patterns on the hospital website ─────────────

const PROBE_PATHS = [
  // Original volunteer paths (keep all existing)
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
  // ── New: expanded volunteer / get-involved paths ─────────────────
  "/volunteer/apply",
  "/volunteer/application",
  "/volunteer-program",
  "/volunteer-programs",
  "/volunteer-resources",
  "/ways-to-give/volunteer",
  "/support/volunteer",
  "/careers/volunteer",
  "/join/volunteer",
  "/join-us",
  "/join-us/volunteer",
  "/join-our-team",
  "/get-involved/volunteering",
  "/get-involved/clinical-volunteering",
  "/community/get-involved",
  "/community-programs/volunteer",
  "/patients-visitors/volunteer",
  "/about-us/volunteer",
  "/about/volunteering",
  // ── New: shadowing / observership paths ──────────────────────────
  "/shadow/apply",
  "/shadowing/apply",
  "/shadowing-program",
  "/observer",
  "/observership",
  "/observer-program",
  "/observership-program",
  "/clinical-observation",
  "/clinical-observer",
  "/student-shadowing",
  "/physician-shadowing",
  "/medical-shadowing",
  "/shadow-program",
  "/shadow-a-doctor",
  "/education/shadowing",
  "/education/observer",
  "/education/observership",
  "/gme/observership",
  "/medical-education/observership",
  // ── New: internship / student program paths ──────────────────────
  "/internship",
  "/internships",
  "/internship/apply",
  "/student-programs",
  "/student-opportunities",
  "/student-services",
  "/clinical-internship",
  "/education/students",
  "/education/student-programs",
  "/careers/internships",
  "/careers/students",
  "/research/opportunities",
  "/research/volunteer",
  "/clinical-experience",
  "/clinical-rotations",
  "/practicum",
  "/externship",
  "/prehealth",
  "/pre-health",
  "/pre-med",
];

/** Known external volunteer management platforms — recognized as high confidence */
const EXTERNAL_PLATFORMS: Record<string, string> = {
  "volgistics.com": "Volgistics",
  "volunteerhub.com": "VolunteerHub",
  "betterimpact.com": "Better Impact",
  "galaxydigital.com": "Galaxy Digital",
  "cervistech.com": "Cervis",
  "volunteerlocal.com": "VolunteerLocal",
  "signup.com": "SignUp.com",
  "handsonconnect.org": "HandsOn Connect",
  "initlive.com": "InitLive",
  "givepulse.com": "GivePulse",
  "samaritan.com": "Samaritan",
  "ivolunteer.com": "iVolunteer",
};

function pathConfidence(path: string): "high" | "medium" {
  const high = ["application", "apply", "shadow", "clinical", "observer", "intern"];
  return high.some((s) => path.includes(s)) ? "high" : "medium";
}

async function probeUrls(websiteHint: string): Promise<LinkResult[]> {
  let origin: string;
  try {
    origin = new URL(websiteHint).origin;
  } catch {
    return [];
  }

  const probes = PROBE_PATHS.map(async (path): Promise<LinkResult | null> => {
    const fullUrl = `${origin}${path}`;
    try {
      const res = await fetch(fullUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "ClinicalHours-Bot/1.0" },
      });
      if (res.ok) {
        // Check if redirect landed on an external volunteer platform
        const finalUrl = res.url || fullUrl;
        const platformLabel = detectPlatform(finalUrl);
        return {
          url: finalUrl,
          confidence: platformLabel ? "high" : pathConfidence(path),
          label: platformLabel
            ? `${platformLabel} Application Portal`
            : `Volunteer Page (${path})`,
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

// ── Relevance filtering ──────────────────────────────────────────────────────

/** Words too generic to use for matching (would match any hospital) */
const STOP_WORDS = new Set([
  "the", "of", "and", "at", "in", "for", "a", "an", "to",
  "hospital", "medical", "center", "clinic", "health", "healthcare",
  "community", "regional", "general", "memorial", "national",
  "university", "system", "group", "services", "care", "inc",
  "llc", "foundation", "network", "county", "city", "state",
]);

/**
 * Extract meaningful words from the organization name for relevance matching.
 * Strips generic medical terms so we match on the distinctive part of the name.
 * e.g. "BCS Free Health Clinic" → ["bcs", "free"]
 *      "Houston Methodist Hospital" → ["houston", "methodist"]
 */
function extractNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Check if a Serper result is actually about the searched organization.
 * Requires at least one distinctive name token to appear in the URL, title, or snippet.
 * External volunteer platforms (Volgistics etc.) pass automatically since they're
 * linked from the org's own page.
 */
function isRelevantResult(
  url: string,
  title: string,
  snippet: string,
  nameTokens: string[],
  websiteHost: string | null,
): boolean {
  // External volunteer platform = always relevant (user searched → Google returned it)
  if (detectPlatform(url)) return true;

  // If we know the hospital's website, results from that domain are relevant
  if (websiteHost) {
    try {
      const resultHost = new URL(url).hostname.toLowerCase();
      if (resultHost === websiteHost || resultHost.endsWith(`.${websiteHost}`)) {
        return true;
      }
    } catch { /* ignore */ }
  }

  // Otherwise require at least one distinctive name token in the result
  if (nameTokens.length === 0) return true; // no tokens extracted — can't filter
  const haystack = `${url} ${title} ${snippet}`.toLowerCase();
  return nameTokens.some((token) => haystack.includes(token));
}

// ── Approach 2: Serper.dev — real Google results (optional) ──────────────────

/** Signals used for confidence scoring of Serper results */
const HIGH_SIGNALS = [
  "apply", "application", "volunteer", "signup", "sign-up", "sign up",
  "register", "form", "shadow", "shadowing", "observer", "observership",
  "intern", "internship", "practicum", "externship", "enroll",
];
const MED_SIGNALS = [
  "volunteer", "opportunity", "join", "community", "program", "clinical",
  "student", "pre-med", "pre-health", "prehealth", "education",
  "get involved", "get-involved", "research",
];

function scoreResult(url: string, title: string, snippet: string): "high" | "medium" | "low" {
  const urlL = url.toLowerCase();
  const titleL = title.toLowerCase();
  const snippetL = snippet.toLowerCase();

  // External platform URL = automatic high
  if (detectPlatform(url)) return "high";

  const isHighUrl = HIGH_SIGNALS.some((s) => urlL.includes(s));
  const isHighTitle = HIGH_SIGNALS.some((s) => titleL.includes(s) || snippetL.includes(s));

  if (isHighUrl && isHighTitle) return "high";
  if (isHighUrl || isHighTitle) return "medium";
  if (MED_SIGNALS.some((s) => titleL.includes(s) || urlL.includes(s))) return "medium";
  return "low";
}

function detectPlatform(url: string): string | null {
  const lower = url.toLowerCase();
  for (const [domain, name] of Object.entries(EXTERNAL_PLATFORMS)) {
    if (lower.includes(domain)) return name;
  }
  return null;
}

async function serperSearch(
  query: string,
  num = 5,
  nameTokens: string[] = [],
  websiteHost: string | null = null,
): Promise<LinkResult[]> {
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.organic ?? []).map((item: { link?: string; title?: string; snippet?: string }) => {
      const url = item.link ?? "";
      if (!url) return null;

      const title = item.title ?? "";
      const snippet = item.snippet ?? "";

      // ── Relevance gate: drop results about other organizations ──
      if (!isRelevantResult(url, title, snippet, nameTokens, websiteHost)) {
        return null;
      }

      const confidence = scoreResult(url, title, snippet);
      const platformLabel = detectPlatform(url);

      return {
        url,
        confidence,
        label: platformLabel ? `${platformLabel}: ${title}` : title || url,
        note: snippet?.slice(0, 140) || undefined,
      } satisfies LinkResult;
    }).filter(Boolean) as LinkResult[];
  } catch {
    return [];
  }
}

/**
 * Run multiple Serper queries in parallel to cover different program types.
 * Uses 3 queries per search instead of 1, each fetching 4 results.
 * Total API cost: ~3 queries per hospital (vs 1 before).
 * Passes nameTokens and websiteHost to each query for relevance filtering.
 */
async function multiSerperSearch(
  name: string,
  nameTokens: string[],
  websiteHost: string | null,
): Promise<LinkResult[]> {
  const queries = [
    // Original query (keep)
    `${name} volunteer application`,
    // Shadowing / observer — the biggest gap in the old approach
    `${name} shadowing OR observer program apply`,
    // Internship / student clinical — covers research, practicum, etc.
    `${name} clinical internship OR student program application`,
  ];

  const results = await Promise.all(
    queries.map((q) => serperSearch(q, 4, nameTokens, websiteHost)),
  );

  return results.flat();
}

/**
 * If no websiteHint is provided, try to discover the hospital's website
 * using Serper so we can still probe URL paths.
 */
async function discoverWebsite(name: string): Promise<string | null> {
  const apiKey = Deno.env.get("SERPER_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `${name} official website`, num: 3 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Try the knowledge graph first (most accurate)
    const kg = data.knowledgeGraph;
    if (kg?.website) return kg.website;

    // Fall back to first organic result that looks like the hospital's own domain
    const nameParts = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w: string) => w.length > 2);
    for (const item of data.organic ?? []) {
      const url = item.link ?? "";
      if (!url) continue;
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        // Skip aggregator / directory sites
        const skipDomains = [
          "yelp.com", "healthgrades.com", "zocdoc.com", "google.com",
          "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
          "wikipedia.org", "npidb.org", "npiprofile.com", "cms.gov",
          "indeed.com", "glassdoor.com", "bbb.org", "mapquest.com",
        ];
        if (skipDomains.some((d) => hostname.includes(d))) continue;

        // Check that at least one meaningful word from the name appears in the domain
        if (nameParts.some((w: string) => hostname.includes(w))) {
          return new URL(url).origin;
        }
      } catch { continue; }
    }
    return null;
  } catch {
    return null;
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

    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Enforce premium subscription (admins bypass)
    const { isAdmin } = await checkAdminRole(user.id);

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading profile for find-application-link:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to load profile" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const now = new Date();
    const expiresAt = profile?.premium_expires_at ? new Date(profile.premium_expires_at as string) : null;
    const isPremiumActive =
      !!profile?.is_premium && (!expiresAt || expiresAt.getTime() > now.getTime());

    if (!isAdmin && !isPremiumActive) {
      return new Response(
        JSON.stringify({ error: "Premium subscription required for this feature." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } },
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

    // ── 3. Live search ─────────────────────────────────────────────────────

    // If no website hint, try to discover it via Serper (costs 1 extra query)
    let probeOrigin = hint;
    if (!probeOrigin) {
      probeOrigin = await discoverWebsite(name);
      if (probeOrigin) {
        console.log(`Discovered website for "${name}": ${probeOrigin}`);
      }
    }

    // Extract distinctive name tokens for relevance filtering
    const nameTokens = extractNameTokens(name);
    let websiteHost: string | null = null;
    if (probeOrigin) {
      try { websiteHost = new URL(probeOrigin).hostname.toLowerCase(); } catch { /* ignore */ }
    }

    // Run path probing + multi-query Serper in parallel
    const [probeResults, serperResults] = await Promise.all([
      probeOrigin ? probeUrls(probeOrigin) : Promise.resolve([]),
      multiSerperSearch(name, nameTokens, websiteHost),
    ]);

    // Merge & deduplicate by normalised URL
    const seenUrls = new Set<string>();
    const links: LinkResult[] = [];
    for (const r of [...probeResults, ...serperResults]) {
      const key = r.url.replace(/\/$/, "").toLowerCase();
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        links.push(r);
        if (links.length >= 8) break;
      }
    }

    // Sort: high → medium → low
    const order = { high: 0, medium: 1, low: 2 };
    links.sort((a, b) => order[a.confidence] - order[b.confidence]);

    console.log(`Live search for "${name}" — ${probeResults.length} probed, ${serperResults.length} serper → ${links.length} deduped`);

    // ── 4. Persist results (fire-and-forget — don't block the response) ────
    storeResults(db, name, hint ?? probeOrigin, links).catch((e) =>
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
