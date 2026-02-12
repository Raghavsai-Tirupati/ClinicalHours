/**
 * Field Discovery Script
 *
 * Fetches a single record from OpenDataSoft us-hospitals
 * and prints every field name + sample value.
 *
 * Run:  npx tsx scripts/discoverFields.ts
 */

const BASE_URL =
  "https://discovery.opendatasoft.com/api/records/1.0/search/";

async function main() {
  const url = `${BASE_URL}?dataset=us-hospitals&rows=1`;
  console.log(`Fetching: ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  console.log(`Total records in dataset: ${data.nhits}\n`);

  const record = data.records?.[0];
  if (!record) {
    console.error("No records returned.");
    process.exit(1);
  }

  const fields: Record<string, unknown> = record.fields;
  const keys = Object.keys(fields).sort();

  console.log(`=== All Field Keys (${keys.length}) ===`);
  for (const k of keys) {
    console.log(`  ${k}`);
  }

  console.log(`\n=== Sample Mapping ===`);
  for (const k of keys) {
    const v = fields[k];
    const display =
      typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`  ${k.padEnd(16)} : ${display.slice(0, 120)}`);
  }

  console.log(`\n=== Record Metadata ===`);
  console.log(`  recordid : ${record.recordid}`);
  console.log(`  geometry : ${JSON.stringify(record.geometry)}`);
  console.log(
    `  timestamp: ${record.record_timestamp ?? "(not present)"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
