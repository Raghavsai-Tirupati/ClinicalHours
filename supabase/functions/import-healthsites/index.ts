import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Country code → full name mapping ────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia",
  NZ: "New Zealand", IE: "Ireland", ZA: "South Africa", IN: "India",
  NG: "Nigeria", KE: "Kenya", GH: "Ghana", TZ: "Tanzania", UG: "Uganda",
  ET: "Ethiopia", PH: "Philippines", PK: "Pakistan", BD: "Bangladesh",
  BR: "Brazil", MX: "Mexico", CO: "Colombia", AR: "Argentina", CL: "Chile",
  PE: "Peru", EG: "Egypt", MA: "Morocco", DE: "Germany", FR: "France",
  ES: "Spain", IT: "Italy", NL: "Netherlands", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", JP: "Japan", KR: "South Korea",
  TH: "Thailand", MY: "Malaysia", ID: "Indonesia", VN: "Vietnam",
  SG: "Singapore", HK: "Hong Kong", TW: "Taiwan", RW: "Rwanda",
  SN: "Senegal", CM: "Cameroon", CD: "Democratic Republic of the Congo",
  MW: "Malawi", MZ: "Mozambique", ZM: "Zambia", ZW: "Zimbabwe",
  MM: "Myanmar", NP: "Nepal", LK: "Sri Lanka", AF: "Afghanistan",
  HT: "Haiti", SL: "Sierra Leone", LR: "Liberia",
};
const ALL_COUNTRIES = Object.keys(COUNTRY_NAMES);

const API_BASE = "https://healthsites.io/api/v3/facilities/";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_CHUNK = 5;
const MAX_SECONDS_PER_CHUNK = 25;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min stale lock
const DELAY_MS = 500;

interface HealthsiteFacility {
  attributes: {
    amenity?: string; healthcare?: string; name?: string; speciality?: string;
    opening_hours?: string; addr_housenumber?: string; addr_street?: string;
    addr_city?: string; addr_postcode?: string;
    "addr:city"?: string; "addr:street"?: string; "addr:housenumber"?: string;
    "addr:postcode"?: string; contact_number?: string; "contact:phone"?: string;
    phone?: string; website?: string; "contact:website"?: string;
    email?: string; "contact:email"?: string; beds?: number | string;
    uuid?: string; [key: string]: unknown;
  };
  centroid: { type: string; coordinates: [number, number] };
  osm_id: number; osm_type: string; completeness?: number;
}

interface Checkpoint {
  countries: string[];
  countryIndex: number;
  page: number;
  totalInserted: number;
  totalSkipped: number;
  totalFetched: number;
  countrySummary: Record<string, { inserted: number; skipped: number }>;
  limit?: number;
  dryRun: boolean;
}

function mapFacilityType(f: HealthsiteFacility): "hospital" | "clinic" | "hospice" | "volunteer" {
  const amenity = (f.attributes.amenity || "").toLowerCase();
  const hc = (f.attributes.healthcare || "").toLowerCase();
  if (amenity === "hospital" || hc === "hospital") return "hospital";
  if (amenity === "hospice" || hc === "hospice") return "hospice";
  if (["clinic", "doctors", "dentist"].includes(amenity) || ["clinic", "doctor", "dentist"].includes(hc)) return "clinic";
  return "clinic";
}

function mapAcceptance(): "high" | "medium" | "low" {
  const r = Math.random();
  return r < 0.3 ? "high" : r < 0.7 ? "medium" : "low";
}

function mapToOpportunity(f: HealthsiteFacility, cc: string): Record<string, unknown> | null {
  const coords = f.centroid?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

  const name = f.attributes.name || f.attributes.amenity || "Healthcare Facility";
  if (!name || name === "yes") return null;

  const city = f.attributes.addr_city || f.attributes["addr:city"] || "";
  const street = f.attributes.addr_street || f.attributes["addr:street"] || "";
  const housenumber = f.attributes.addr_housenumber || f.attributes["addr:housenumber"] || "";
  const postcode = f.attributes.addr_postcode || f.attributes["addr:postcode"] || "";
  const addressParts = [housenumber, street].filter(Boolean).join(" ");
  const location = [city, cc.toUpperCase()].filter(Boolean).join(", ") || "Unknown";

  const phone = f.attributes.contact_number || f.attributes["contact:phone"] || f.attributes.phone || null;
  const website = f.attributes.website || f.attributes["contact:website"] || null;
  const email = f.attributes.email || f.attributes["contact:email"] || null;

  const descParts: string[] = [];
  const healthcare = f.attributes.healthcare || f.attributes.amenity;
  if (healthcare) descParts.push(`Type: ${healthcare}`);
  if (f.attributes.speciality) descParts.push(`Speciality: ${f.attributes.speciality}`);
  if (f.attributes.opening_hours) descParts.push(`Hours: ${f.attributes.opening_hours}`);
  if (f.attributes.beds) descParts.push(`Beds: ${f.attributes.beds}`);

  return {
    name: String(name).slice(0, 200),
    type: mapFacilityType(f),
    location, address: [addressParts, city, postcode].filter(Boolean).join(", ") || null,
    latitude: lat, longitude: lng,
    hours_required: "Varies",
    acceptance_likelihood: mapAcceptance(),
    phone, email, website,
    description: descParts.join(". ") || null,
    source: "healthsites",
    external_id: `healthsites-${f.osm_type}-${f.osm_id}`,
    country_code: cc.toUpperCase(),
  };
}

async function fetchWithRetry(url: string, retries = 4): Promise<HealthsiteFacility[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = Math.min(attempt * 2000 * Math.pow(2, attempt - 1), 30000);
        console.log(`429 rate limited, backing off ${wait}ms (attempt ${attempt})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (res.status >= 500) {
        const wait = Math.min(attempt * 1000 * Math.pow(2, attempt - 1), 20000);
        console.log(`Server ${res.status}, backing off ${wait}ms (attempt ${attempt})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.min(attempt * 1000 * Math.pow(2, attempt - 1), 20000);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return [];
}

// ─── Lock helpers ────────────────────────────────────────────────────────────
async function acquireLock(db: ReturnType<typeof createClient>): Promise<boolean> {
  // Try to set status=running only if idle or stale lock
  const { data, error } = await db.from("import_jobs")
    .update({ status: "running", locked_at: new Date().toISOString(), error: null })
    .eq("job_type", "healthsites")
    .or(`status.eq.idle,status.eq.completed,status.eq.failed,locked_at.lt.${new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString()}`)
    .select("id");

  if (error) { console.error("Lock acquire error:", error.message); return false; }
  return (data?.length || 0) > 0;
}

async function releaseLock(db: ReturnType<typeof createClient>, status: string, error?: string) {
  await db.from("import_jobs")
    .update({
      status,
      locked_at: null,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      ...(error ? { error } : { error: null }),
    })
    .eq("job_type", "healthsites");
}

async function saveCheckpoint(db: ReturnType<typeof createClient>, cp: Checkpoint) {
  await db.from("import_jobs")
    .update({ checkpoint: cp as unknown as Record<string, unknown>, summary: cp.countrySummary as unknown as Record<string, unknown> })
    .eq("job_type", "healthsites");
}

async function loadCheckpoint(db: ReturnType<typeof createClient>): Promise<Checkpoint | null> {
  const { data } = await db.from("import_jobs")
    .select("checkpoint")
    .eq("job_type", "healthsites")
    .maybeSingle();
  if (!data?.checkpoint || typeof data.checkpoint !== "object") return null;
  const cp = data.checkpoint as unknown as Checkpoint;
  if (!cp.countries || cp.countryIndex === undefined) return null;
  return cp;
}

// ─── Self-invoke next chunk ──────────────────────────────────────────────────
async function scheduleNextChunk(token: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/import-healthsites`;
  try {
    // Fire-and-forget with short timeout awareness
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ _continue: true }),
    });
  } catch (err) {
    console.error("Self-schedule failed (will resume on next manual call):", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("HEALTHSITES_API_KEY");

  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: "HEALTHSITES_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await db
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse params ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const isContinue = body._continue === true;
    const isStatus = body._status === true;
    const isCancel = body._cancel === true;

    // ── Status check ─────────────────────────────────────────────────────
    if (isStatus) {
      const { data: job } = await db.from("import_jobs")
        .select("*").eq("job_type", "healthsites").maybeSingle();
      return new Response(JSON.stringify({ success: true, job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Cancel ───────────────────────────────────────────────────────────
    if (isCancel) {
      await releaseLock(db, "idle");
      await db.from("import_jobs").update({ checkpoint: {} }).eq("job_type", "healthsites");
      return new Response(JSON.stringify({ success: true, cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Acquire lock ─────────────────────────────────────────────────────
    const gotLock = await acquireLock(db);
    if (!gotLock) {
      return new Response(JSON.stringify({
        success: false, error: "Import already running. Use _status to check progress or _cancel to abort.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Build or resume checkpoint ───────────────────────────────────────
    let cp: Checkpoint;
    if (isContinue) {
      const saved = await loadCheckpoint(db);
      if (!saved) {
        await releaseLock(db, "idle");
        return new Response(JSON.stringify({ success: true, done: true, message: "No checkpoint to resume" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      cp = saved;
    } else {
      const { countries: reqCountries, limit, dryRun = false } = body as {
        countries?: string[] | "all"; limit?: number; dryRun?: boolean;
      };
      const countries =
        reqCountries === "all" ? ALL_COUNTRIES :
        Array.isArray(reqCountries) && reqCountries.length > 0 ? reqCountries.map((c: string) => c.toUpperCase()) :
        ["US"];

      cp = {
        countries, countryIndex: 0, page: 1,
        totalInserted: 0, totalSkipped: 0, totalFetched: 0,
        countrySummary: {}, limit, dryRun,
      };
      // Record start
      await db.from("import_jobs").update({
        params: body, started_at: new Date().toISOString(), completed_at: null, summary: {},
      }).eq("job_type", "healthsites");
    }

    const maxRows = cp.limit || Infinity;
    const startTime = Date.now();
    let pagesThisChunk = 0;
    let done = false;

    console.log(`Chunk start: country=${cp.countries[cp.countryIndex]}, page=${cp.page}, fetched=${cp.totalFetched}`);

    // ── Process pages in bounded chunk ───────────────────────────────────
    outer:
    while (cp.countryIndex < cp.countries.length) {
      const cc = cp.countries[cp.countryIndex];
      const countryName = COUNTRY_NAMES[cc] || cc;
      if (!cp.countrySummary[cc]) cp.countrySummary[cc] = { inserted: 0, skipped: 0 };

      while (cp.totalFetched < maxRows) {
        // Check chunk bounds
        if (pagesThisChunk >= MAX_PAGES_PER_CHUNK || (Date.now() - startTime) > MAX_SECONDS_PER_CHUNK * 1000) {
          break outer;
        }

        const remaining = maxRows - cp.totalFetched;
        const fetchSize = Math.min(PAGE_SIZE, remaining);
        const url = `${API_BASE}?api-key=${apiKey}&country=${encodeURIComponent(countryName)}&page=${cp.page}&page_size=${fetchSize}`;

        const facilities = await fetchWithRetry(url);
        pagesThisChunk++;

        if (facilities.length === 0) {
          // Country done
          cp.countryIndex++;
          cp.page = 1;
          break;
        }

        const batch: Record<string, unknown>[] = [];
        for (const f of facilities) {
          const mapped = mapToOpportunity(f, cc);
          if (!mapped) { cp.countrySummary[cc].skipped++; cp.totalSkipped++; continue; }
          batch.push(mapped);
          cp.totalFetched++;
          if (cp.totalFetched >= maxRows) break;
        }

        if (batch.length > 0 && !cp.dryRun) {
          const { error, data } = await db
            .from("opportunities")
            .upsert(batch, { onConflict: "source,external_id", ignoreDuplicates: false })
            .select("id");

          if (error) {
            console.error(`Upsert error ${cc} p${cp.page}:`, error.message);
            for (const row of batch) {
              const { error: rowErr } = await db
                .from("opportunities")
                .upsert(row, { onConflict: "source,external_id", ignoreDuplicates: false });
              if (rowErr) { cp.countrySummary[cc].skipped++; cp.totalSkipped++; }
              else { cp.countrySummary[cc].inserted++; cp.totalInserted++; }
            }
          } else {
            const count = data?.length || batch.length;
            cp.countrySummary[cc].inserted += count;
            cp.totalInserted += count;
          }
        } else if (cp.dryRun) {
          cp.countrySummary[cc].inserted += batch.length;
          cp.totalInserted += batch.length;
        }

        console.log(`${cc} p${cp.page}: fetched=${facilities.length}, batch=${batch.length}, total=${cp.totalFetched}`);
        cp.page++;
        await new Promise(r => setTimeout(r, DELAY_MS));

        if (cp.totalFetched >= maxRows) { done = true; break outer; }
      }

      // If we exited the inner while because totalFetched >= maxRows
      if (cp.totalFetched >= maxRows) { done = true; break; }

      // Country finished naturally, move to next
      cp.countryIndex++;
      cp.page = 1;
    }

    // Check if truly done
    if (cp.countryIndex >= cp.countries.length) done = true;

    // ── Save checkpoint ──────────────────────────────────────────────────
    await saveCheckpoint(db, cp);

    if (done) {
      await releaseLock(db, "completed");
      console.log("Import complete:", JSON.stringify({ totalInserted: cp.totalInserted, totalSkipped: cp.totalSkipped }));
    } else {
      // Schedule next chunk (self-call)
      console.log(`Chunk done, scheduling next. Progress: ${cp.totalFetched} fetched, country ${cp.countryIndex}/${cp.countries.length}`);
      // Keep lock as running, fire next chunk
      scheduleNextChunk(token);
    }

    return new Response(JSON.stringify({
      success: true,
      done,
      nextRunScheduled: !done,
      totalInserted: cp.totalInserted,
      totalSkipped: cp.totalSkipped,
      totalFetched: cp.totalFetched,
      currentCountry: done ? null : cp.countries[cp.countryIndex],
      currentPage: cp.page,
      countriesProcessed: Object.keys(cp.countrySummary),
      countrySummary: cp.countrySummary,
      dryRun: cp.dryRun,
      pagesThisChunk,
      elapsedMs: Date.now() - startTime,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Import error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    await releaseLock(db, "failed", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
