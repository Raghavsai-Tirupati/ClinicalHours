/**
 * Direct import of US hospitals from OpenDataSoft into Supabase opportunities table.
 * Uses the service role key to bypass RLS.
 * 
 * Run: npx tsx scripts/directImport.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ODS_BASE = "https://discovery.opendatasoft.com/api/records/1.0/search/";
const DATASET = "us-hospitals";
const PAGE_SIZE = 100;
const UPSERT_BATCH = 200;

interface ODSRecord {
  fields: {
    name?: string;
    city?: string;
    state?: string;
    type?: string;
    telephone?: string;
    website?: string;
    beds?: number;
    owner?: string;
    trauma?: string;
    geo_point?: [number, number];
    [key: string]: unknown;
  };
}

function mapType(odsType: string | undefined): string {
  if (!odsType) return "hospital";
  const t = odsType.toLowerCase();
  if (t.includes("clinic") || t.includes("critical access")) return "clinic";
  if (t.includes("hospice")) return "hospice";
  return "hospital";
}

function mapAcceptance(): string {
  // Random distribution
  const r = Math.random();
  if (r < 0.3) return "high";
  if (r < 0.7) return "medium";
  return "low";
}

async function fetchPage(start: number): Promise<{ records: ODSRecord[]; nhits: number }> {
  const url = `${ODS_BASE}?dataset=${DATASET}&rows=${PAGE_SIZE}&start=${start}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ODS ${res.status}`);
  const json = await res.json();
  return { records: json.records, nhits: json.nhits };
}

async function main() {
  console.log("=== Direct Hospital Import ===\n");

  let start = 0;
  let total = 0;
  let inserted = 0;
  let skipped = 0;
  let batch: Record<string, unknown>[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const { error, count } = await supabase
      .from("opportunities")
      .upsert(batch, { onConflict: "name,location", ignoreDuplicates: true })
      .select("id");
    
    if (error) {
      // If upsert fails due to no unique constraint, just insert
      const { error: insertError } = await supabase
        .from("opportunities")
        .insert(batch);
      if (insertError) {
        console.error(`  Insert error: ${insertError.message}`);
        skipped += batch.length;
      } else {
        inserted += batch.length;
      }
    } else {
      inserted += batch.length;
    }
    batch = [];
  }

  while (true) {
    const { records, nhits } = await fetchPage(start);
    if (total === 0) {
      total = nhits;
      console.log(`Total hospitals in dataset: ${total}\n`);
    }

    if (records.length === 0) break;

    for (const rec of records) {
      const f = rec.fields;
      const lat = f.geo_point?.[0];
      const lon = f.geo_point?.[1];
      if (!lat || !lon || !f.name) { skipped++; continue; }

      const city = f.city || "";
      const state = f.state || "";
      const location = [city, state].filter(Boolean).join(", ") || "Unknown";

      batch.push({
        name: (f.name || "Unknown").slice(0, 200),
        type: mapType(f.type as string),
        location,
        latitude: lat,
        longitude: lon,
        hours_required: "Varies",
        acceptance_likelihood: mapAcceptance(),
        phone: f.telephone && f.telephone !== "Not Available" ? f.telephone : null,
        website: f.website && f.website !== "Not Available" ? f.website : null,
        description: [
          f.type,
          f.owner ? `Ownership: ${f.owner}` : null,
          f.beds ? `Beds: ${f.beds}` : null,
          f.trauma && f.trauma !== "Not Available" ? `Trauma: ${f.trauma}` : null,
        ].filter(Boolean).join(". ") || null,
      });

      if (batch.length >= UPSERT_BATCH) {
        await flushBatch();
      }
    }

    start += PAGE_SIZE;
    const pct = Math.min(100, (start / total) * 100).toFixed(1);
    console.log(`Progress: ${start}/${total} (${pct}%) | inserted=${inserted} skipped=${skipped}`);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  await flushBatch();

  console.log("\n=== Done ===");
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
