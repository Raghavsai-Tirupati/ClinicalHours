/**
 * Import US Hospitals from OpenDataSoft → opportunities table
 *
 * Uses the existing import-texas-hospitals edge function (which handles
 * dedup and uses service_role_key internally). No database password needed.
 *
 * Run:  npx tsx scripts/importHospitals.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { searchHospitals, type ODSRecord } from "../lib/odsClient.js";

import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 100;
const BATCH_SIZE = 100; // records per edge function call
const CHECKPOINT_FILE = "scripts/.import-checkpoint.json";
const DELAY_MS = 300;

// ─── Checkpoint ───────────────────────────────────────────────────────────────

interface Checkpoint {
  start: number;
  processed: number;
  imported: number;
  skipped: number;
}

function loadCheckpoint(): Checkpoint {
  if (existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(readFileSync(CHECKPOINT_FILE, "utf-8"));
      console.log(
        `Resuming from checkpoint: start=${cp.start}, processed=${cp.processed}`,
      );
      return cp as Checkpoint;
    } catch {
      /* corrupt, start fresh */
    }
  }
  return { start: 0, processed: 0, imported: 0, skipped: 0 };
}

function saveCheckpoint(cp: Checkpoint): void {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── Map ODS record → edge function format ────────────────────────────────────
// The import-texas-hospitals edge function expects: { csvData: HospitalCSVRow[] }
// where HospitalCSVRow = { name, website, email, phone, bio, city, state, lat, lon, source }

function mapToCSVRow(rec: ODSRecord) {
  const f = rec.fields;
  const lat = f.geo_point?.[0] ?? null;
  const lon = f.geo_point?.[1] ?? null;

  if (lat === null || lon === null) return null;

  // Build a description from available ODS fields
  const bioParts: string[] = [];
  if (f.type && f.type !== "Not Available") bioParts.push(f.type);
  if (f.owner && f.owner !== "Not Available") bioParts.push(`Ownership: ${f.owner}`);
  if (f.beds && f.beds > 0) bioParts.push(`Beds: ${f.beds}`);
  if (f.trauma && f.trauma !== "Not Available") bioParts.push(`Trauma: ${f.trauma}`);
  if (f.helipad && f.helipad !== "Not Available") bioParts.push(`Helipad: ${f.helipad}`);

  return {
    name: (f.name || "Unknown Hospital").slice(0, 200),
    website: f.website && f.website !== "Not Available" ? f.website : "",
    email: "",
    phone: f.telephone && f.telephone !== "Not Available" ? f.telephone : "",
    bio: bioParts.join(". ") || "",
    city: f.city || "",
    state: f.state || "",
    lat: String(lat),
    lon: String(lon),
    source: "opendatasoft",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Import US Hospitals (OpenDataSoft → opportunities) ===\n");

  const cp = loadCheckpoint();
  let { start, processed, imported, skipped } = cp;
  let nhits = 0;

  // Collect all records from ODS first, then send in batches to edge function
  let pendingBatch: ReturnType<typeof mapToCSVRow>[] = [];

  async function flushBatch() {
    const valid = pendingBatch.filter(Boolean);
    if (valid.length === 0) return;

    const { data, error } = await supabase.functions.invoke(
      "import-texas-hospitals",
      { body: { csvData: valid } },
    );

    if (error) {
      console.error(`  Edge function error: ${error.message}`);
      return;
    }

    if (data?.error) {
      console.error(`  Edge function returned error: ${data.error}`);
      return;
    }

    imported += data?.imported || 0;
    skipped += data?.duplicates || 0;

    if (data?.imported > 0) {
      console.log(`  Inserted ${data.imported} hospitals`);
    }
    if (data?.duplicates > 0) {
      console.log(`  Skipped ${data.duplicates} duplicates`);
    }

    pendingBatch = [];
  }

  while (true) {
    console.log(`Fetching ODS page start=${start} rows=${PAGE_SIZE} ...`);
    const resp = await searchHospitals({ rows: PAGE_SIZE, start });

    if (!nhits) {
      nhits = resp.nhits;
      console.log(`Dataset total: ${nhits} hospitals\n`);
    }

    if (resp.records.length === 0) {
      // Flush remaining
      await flushBatch();
      console.log("No more records.\n");
      break;
    }

    for (const rec of resp.records) {
      const mapped = mapToCSVRow(rec);
      if (mapped) {
        pendingBatch.push(mapped);
      } else {
        skipped++;
      }
      processed++;

      // Send batch to edge function when full
      if (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    start += PAGE_SIZE;
    const pct = Math.min(100, (start / nhits) * 100).toFixed(1);
    console.log(
      `  Progress: processed=${processed} imported=${imported} skipped=${skipped} (${pct}%)\n`,
    );

    saveCheckpoint({ start, processed, imported, skipped });
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // Final flush
  if (pendingBatch.length > 0) {
    await flushBatch();
  }

  console.log("=".repeat(50));
  console.log("Done.");
  console.log(`  Processed : ${processed}`);
  console.log(`  Inserted  : ${imported}`);
  console.log(`  Skipped   : ${skipped}`);
  console.log("=".repeat(50));

  if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
