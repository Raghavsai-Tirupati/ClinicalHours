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
const UPSERT_BATCH = 200;
const DELAY_MS = 500;

interface HealthsiteFacility {
  attributes: {
    amenity?: string;
    healthcare?: string;
    name?: string;
    speciality?: string;
    opening_hours?: string;
    addr_housenumber?: string;
    addr_street?: string;
    addr_city?: string;
    addr_postcode?: string;
    "addr:city"?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    "addr:postcode"?: string;
    contact_number?: string;
    "contact:phone"?: string;
    phone?: string;
    website?: string;
    "contact:website"?: string;
    email?: string;
    "contact:email"?: string;
    beds?: number | string;
    uuid?: string;
    [key: string]: unknown;
  };
  centroid: { type: string; coordinates: [number, number] };
  osm_id: number;
  osm_type: string;
  completeness?: number;
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
    location,
    address: [addressParts, city, postcode].filter(Boolean).join(", ") || null,
    latitude: lat,
    longitude: lng,
    hours_required: "Varies",
    acceptance_likelihood: mapAcceptance(),
    phone, email, website,
    description: descParts.join(". ") || null,
    source: "healthsites",
    external_id: `healthsites-${f.osm_type}-${f.osm_id}`,
    country_code: cc.toUpperCase(),
  };
}

async function fetchWithRetry(url: string, retries = 3): Promise<HealthsiteFacility[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = attempt * 2000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check (admin only) ──────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("HEALTHSITES_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "HEALTHSITES_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse params ─────────────────────────────────────────────────────
    const body = await req.json();
    const {
      countries: reqCountries,
      limit,
      dryRun = false,
      resume = false,
    } = body as {
      countries?: string[] | "all";
      limit?: number;
      dryRun?: boolean;
      resume?: boolean;
    };

    const countries: string[] =
      reqCountries === "all" ? ALL_COUNTRIES :
      Array.isArray(reqCountries) && reqCountries.length > 0 ? reqCountries.map(c => c.toUpperCase()) :
      ["US"];

    const maxRows = limit || Infinity;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFetched = 0;
    const countrySummary: Record<string, { inserted: number; updated: number; skipped: number }> = {};

    console.log(`Import starting: countries=${countries.join(",")}, limit=${limit || "none"}, dryRun=${dryRun}, resume=${resume}`);

    for (const cc of countries) {
      if (totalFetched >= maxRows) break;

      const countryName = COUNTRY_NAMES[cc] || cc;
      let page = 1;
      let cInserted = 0, cUpdated = 0, cSkipped = 0;

      // If resume, find what page to start from by checking existing count
      if (resume) {
        const { count } = await supabaseAdmin
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("source", "healthsites")
          .eq("country_code", cc);
        if (count && count > 0) {
          page = Math.floor(count / PAGE_SIZE) + 1;
          console.log(`Resuming ${cc} from page ${page} (${count} existing)`);
        }
      }

      while (totalFetched < maxRows) {
        const remaining = maxRows - totalFetched;
        const fetchSize = Math.min(PAGE_SIZE, remaining);
        const url = `${API_BASE}?api-key=${apiKey}&country=${encodeURIComponent(countryName)}&page=${page}&page_size=${fetchSize}`;

        const facilities = await fetchWithRetry(url);
        if (facilities.length === 0) break;

        const batch: Record<string, unknown>[] = [];
        for (const f of facilities) {
          const mapped = mapToOpportunity(f, cc);
          if (!mapped) { cSkipped++; continue; }
          batch.push(mapped);
          totalFetched++;
          if (totalFetched >= maxRows) break;
        }

        if (batch.length > 0 && !dryRun) {
          // Upsert by external_id — updates if exists, inserts if not
          const { error, data } = await supabaseAdmin
            .from("opportunities")
            .upsert(batch, { onConflict: "source,external_id", ignoreDuplicates: false })
            .select("id");

          if (error) {
            console.error(`Upsert error for ${cc} page ${page}:`, error.message);
            // Fallback: try one-by-one
            for (const row of batch) {
              const { error: rowErr } = await supabaseAdmin
                .from("opportunities")
                .upsert(row, { onConflict: "source,external_id", ignoreDuplicates: false });
              if (rowErr) { cSkipped++; } else { cInserted++; }
            }
          } else {
            // Count: upsert returns all rows (both inserted and updated)
            cInserted += data?.length || batch.length;
          }
        } else if (dryRun) {
          cInserted += batch.length; // would-be inserts
        }

        console.log(`${cc} page ${page}: fetched=${facilities.length}, batch=${batch.length}, total=${totalFetched}`);
        page++;
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      countrySummary[cc] = { inserted: cInserted, updated: cUpdated, skipped: cSkipped };
      totalInserted += cInserted;
      totalUpdated += cUpdated;
      totalSkipped += cSkipped;
    }

    const result = {
      success: true,
      dryRun,
      totalInserted,
      totalUpdated,
      totalSkipped,
      totalFetched,
      countriesProcessed: Object.keys(countrySummary),
      countrySummary,
    };

    console.log("Import complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Import error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
