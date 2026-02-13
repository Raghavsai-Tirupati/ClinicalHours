/**
 * Import healthcare facilities from Healthsites.io → opportunities table
 *
 * Usage:
 *   npx tsx scripts/importHealthsites.ts --country CA
 *   npx tsx scripts/importHealthsites.ts --allCountries
 *
 * Requires env vars (in .env.local):
 *   HEALTHSITES_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://plckixtvwknonltwutus.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsY2tpeHR2d2tub25sdHd1dHVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgzMjI1NywiZXhwIjoyMDg2NDA4MjU3fQ.Gp0FnCsxdoKD2PlMXdYqVGxLr4502YwxHp9Jr_M5eYg";
const HEALTHSITES_API_KEY =
  process.env.HEALTHSITES_API_KEY ||
  "05d5f5f519e71f137e1e604715449a842477aa6c";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const API_BASE = "https://healthsites.io/api/v3/facilities/";
const PAGE_SIZE = 100;
const UPSERT_BATCH = 200;
const DELAY_MS = 500; // be polite to the API

// ─── Country code → full name mapping ────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  IE: "Ireland",
  ZA: "South Africa",
  IN: "India",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  TZ: "Tanzania",
  UG: "Uganda",
  ET: "Ethiopia",
  PH: "Philippines",
  PK: "Pakistan",
  BD: "Bangladesh",
  BR: "Brazil",
  MX: "Mexico",
  CO: "Colombia",
  AR: "Argentina",
  CL: "Chile",
  PE: "Peru",
  EG: "Egypt",
  MA: "Morocco",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  JP: "Japan",
  KR: "South Korea",
  TH: "Thailand",
  MY: "Malaysia",
  ID: "Indonesia",
  VN: "Vietnam",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  RW: "Rwanda",
  SN: "Senegal",
  CM: "Cameroon",
  CD: "Democratic Republic of the Congo",
  MW: "Malawi",
  MZ: "Mozambique",
  ZM: "Zambia",
  ZW: "Zimbabwe",
  MM: "Myanmar",
  NP: "Nepal",
  LK: "Sri Lanka",
  AF: "Afghanistan",
  HT: "Haiti",
  SL: "Sierra Leone",
  LR: "Liberia",
};

function getCountryName(iso: string): string {
  return COUNTRY_NAMES[iso.toUpperCase()] || iso;
}

// Countries to import when using --allCountries
const ALL_COUNTRIES = [
  "US",
  "CA",
  "GB",
  "AU",
  "NZ",
  "IE",
  "ZA",
  "IN",
  "NG",
  "KE",
  "GH",
  "TZ",
  "UG",
  "ET",
  "PH",
  "PK",
  "BD",
  "BR",
  "MX",
  "CO",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "JP",
  "TH",
  "ID",
  "VN",
  "RW",
  "SN",
  "CM",
  "MW",
  "MZ",
  "ZM",
  "ZW",
  "NP",
  "MM",
  "HT",
  "SL",
  "LR",
  "AF",
];

// ─── Healthsites API types ───────────────────────────────────────────────────

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
  centroid: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  osm_id: number;
  osm_type: string;
  completeness?: number;
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapFacilityType(
  facility: HealthsiteFacility
): "hospital" | "clinic" | "hospice" | "volunteer" {
  const amenity = (facility.attributes.amenity || "").toLowerCase();
  const healthcare = (facility.attributes.healthcare || "").toLowerCase();

  if (amenity === "hospital" || healthcare === "hospital") return "hospital";
  if (amenity === "hospice" || healthcare === "hospice") return "hospice";
  if (
    amenity === "clinic" ||
    amenity === "doctors" ||
    amenity === "dentist" ||
    healthcare === "clinic" ||
    healthcare === "doctor" ||
    healthcare === "dentist"
  )
    return "clinic";
  // Default anything else to clinic
  return "clinic";
}

function mapAcceptance(): "high" | "medium" | "low" {
  const r = Math.random();
  if (r < 0.3) return "high";
  if (r < 0.7) return "medium";
  return "low";
}

function mapToOpportunity(
  facility: HealthsiteFacility,
  countryCode: string
): Record<string, unknown> | null {
  const attrs = facility.attributes;
  const coords = facility.centroid?.coordinates;

  if (!coords || coords.length < 2) return null;

  const lng = coords[0];
  const lat = coords[1];
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

  const name = attrs.name || attrs.amenity || "Healthcare Facility";
  if (!name || name === "yes") return null;

  // Build location string
  const city =
    attrs.addr_city || attrs["addr:city"] || "";
  const street =
    attrs.addr_street || attrs["addr:street"] || "";
  const housenumber =
    attrs.addr_housenumber || attrs["addr:housenumber"] || "";
  const postcode =
    attrs.addr_postcode || attrs["addr:postcode"] || "";

  const addressParts = [housenumber, street].filter(Boolean).join(" ");
  const locationParts = [city, countryCode.toUpperCase()].filter(Boolean);
  const location = locationParts.join(", ") || "Unknown";

  // Phone
  const phone =
    attrs.contact_number ||
    attrs["contact:phone"] ||
    attrs.phone ||
    null;

  // Website
  const website =
    attrs.website || attrs["contact:website"] || null;

  // Email
  const email = attrs.email || attrs["contact:email"] || null;

  // Description
  const descParts: string[] = [];
  const healthcare = attrs.healthcare || attrs.amenity;
  if (healthcare) descParts.push(`Type: ${healthcare}`);
  if (attrs.speciality) descParts.push(`Speciality: ${attrs.speciality}`);
  if (attrs.opening_hours) descParts.push(`Hours: ${attrs.opening_hours}`);
  if (attrs.beds) descParts.push(`Beds: ${attrs.beds}`);

  const externalId = `healthsites-${facility.osm_type}-${facility.osm_id}`;

  return {
    name: String(name).slice(0, 200),
    type: mapFacilityType(facility),
    location,
    address: [addressParts, city, postcode].filter(Boolean).join(", ") || null,
    latitude: lat,
    longitude: lng,
    hours_required: "Varies",
    acceptance_likelihood: mapAcceptance(),
    phone,
    email,
    website,
    description: descParts.join(". ") || null,
    source: "healthsites",
    external_id: externalId,
    country_code: countryCode.toUpperCase(),
  };
}

// ─── API fetch with retry ────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  retries = 3
): Promise<HealthsiteFacility[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = attempt * 2000;
        console.log(`  Rate limited, waiting ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      // API returns a flat array
      if (Array.isArray(data)) return data as HealthsiteFacility[];
      // Unexpected format
      console.warn(`  Unexpected response format, got:`, typeof data);
      return [];
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = attempt * 1000;
      console.log(
        `  Fetch error (attempt ${attempt}/${retries}): ${err}. Retrying in ${wait}ms...`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return [];
}

// ─── Import a single country ─────────────────────────────────────────────────

async function importCountry(
  countryCode: string
): Promise<{ inserted: number; skipped: number }> {
  const countryName = getCountryName(countryCode);
  console.log(`\n── Importing ${countryName} (${countryCode}) ──`);

  let page = 1;
  let inserted = 0;
  let skipped = 0;
  let batch: Record<string, unknown>[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("opportunities")
      .upsert(batch, { onConflict: "external_id", ignoreDuplicates: true });
    if (error) {
      // Try one-by-one on conflict
      let ok = 0;
      let fail = 0;
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from("opportunities")
          .upsert(row, { onConflict: "external_id", ignoreDuplicates: true });
        if (rowErr) {
          fail++;
        } else {
          ok++;
        }
      }
      inserted += ok;
      skipped += fail;
    } else {
      inserted += batch.length;
    }
    batch = [];
  }

  while (true) {
    const url = `${API_BASE}?api-key=${HEALTHSITES_API_KEY}&country=${encodeURIComponent(countryName)}&page=${page}&page_size=${PAGE_SIZE}`;

    const facilities = await fetchWithRetry(url);

    if (facilities.length === 0) {
      // No more results — end of pagination
      break;
    }

    for (const facility of facilities) {
      const mapped = mapToOpportunity(facility, countryCode);
      if (mapped) {
        batch.push(mapped);
      } else {
        skipped++;
      }

      if (batch.length >= UPSERT_BATCH) {
        await flushBatch();
      }
    }

    console.log(
      `  Page ${page}: fetched=${facilities.length} | total inserted=${inserted} skipped=${skipped}`
    );

    page++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // Flush remaining
  await flushBatch();

  console.log(
    `  ${countryName} done: inserted=${inserted}, skipped=${skipped}`
  );
  return { inserted, skipped };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const countryIdx = args.indexOf("--country");
  const allCountries = args.includes("--allCountries");

  let countries: string[] = [];

  if (allCountries) {
    countries = ALL_COUNTRIES;
  } else if (countryIdx !== -1 && args[countryIdx + 1]) {
    countries = [args[countryIdx + 1].toUpperCase()];
  } else {
    console.log(
      "Usage:\n  npx tsx scripts/importHealthsites.ts --country CA\n  npx tsx scripts/importHealthsites.ts --allCountries"
    );
    process.exit(1);
  }

  console.log("=== Healthsites.io Import ===");
  console.log(`Countries: ${countries.join(", ")}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const code of countries) {
    const { inserted, skipped } = await importCountry(code);
    totalInserted += inserted;
    totalSkipped += skipped;
  }

  console.log("\n" + "=".repeat(50));
  console.log("Import complete.");
  console.log(`  Total inserted : ${totalInserted}`);
  console.log(`  Total skipped  : ${totalSkipped}`);
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
