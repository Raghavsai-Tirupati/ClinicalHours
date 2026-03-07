import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_LIKELIHOOD = new Set(["high", "medium", "low"]);
const VALID_TYPE = new Set(["hospital", "clinic", "hospice", "emt", "volunteer"]);
const EXPECTED_COLS = 22;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function emptyToNull(s: string | undefined): string | null {
  if (!s || s.trim() === "" || s.trim() === "N/A") return null;
  return s.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("Running as service role - admin bypass for data migration");

    // Fetch CSV from storage
    const csvUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/imports/opportunities-deduped.csv`;
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
    const csvText = await csvRes.text();

    const lines = csvText.split("\n").filter(l => l.trim().length > 0);
    console.log("Total lines (incl header):", lines.length);

    // Build header index from first line
    const header = lines[0].split(";").map(h => h.trim());
    const idx: Record<string, number> = {};
    header.forEach((h, i) => { idx[h] = i; });
    console.log("Columns:", header.length, "Header:", header.join("|"));

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");

      // If we have more columns than expected, the description likely contains semicolons
      // Merge extra columns back into the description field (index 13)
      if (cols.length > EXPECTED_COLS) {
        const descIdx = idx["description"];
        const extra = cols.length - EXPECTED_COLS;
        // Merge cols[descIdx] through cols[descIdx + extra] into one field
        const mergedDesc = cols.slice(descIdx, descIdx + extra + 1).join(";");
        cols.splice(descIdx, extra + 1, mergedDesc);
      }

      if (cols.length < EXPECTED_COLS) {
        skipped++;
        continue;
      }

      const name = cols[idx["name"]]?.trim();
      if (!name) { skipped++; continue; }

      const rawId = cols[idx["id"]]?.trim();
      const rawCreatedBy = emptyToNull(cols[idx["created_by"]]);
      const rawHospitalId = emptyToNull(cols[idx["hospital_id"]]);
      const rawLikelihood = cols[idx["acceptance_likelihood"]]?.trim().toLowerCase() || "medium";
      const rawType = cols[idx["type"]]?.trim().toLowerCase() || "hospital";

      const lat = parseFloat(cols[idx["latitude"]]?.trim() || "");
      const lon = parseFloat(cols[idx["longitude"]]?.trim() || "");

      rows.push({
        id: isUuid(rawId) ? rawId : undefined,
        name: name.slice(0, 300),
        type: VALID_TYPE.has(rawType) ? rawType : "hospital",
        location: cols[idx["location"]]?.trim() || "Unknown",
        address: emptyToNull(cols[idx["address"]]),
        latitude: isNaN(lat) ? null : lat,
        longitude: isNaN(lon) ? null : lon,
        hours_required: cols[idx["hours_required"]]?.trim() || "Varies",
        acceptance_likelihood: VALID_LIKELIHOOD.has(rawLikelihood) ? rawLikelihood : "medium",
        phone: emptyToNull(cols[idx["phone"]]),
        email: emptyToNull(cols[idx["email"]]),
        website: emptyToNull(cols[idx["website"]]),
        requirements: [],
        description: emptyToNull(cols[idx["description"]]),
        created_by: rawCreatedBy && isUuid(rawCreatedBy) ? rawCreatedBy : null,
        source: emptyToNull(cols[idx["source"]]),
        external_id: emptyToNull(cols[idx["external_id"]]),
        country_code: emptyToNull(cols[idx["country_code"]]),
        slug: emptyToNull(cols[idx["slug"]]),
        hospital_id: rawHospitalId && isUuid(rawHospitalId) ? rawHospitalId : null,
      });
    }

    console.log(`Parsed: ${rows.length}, Skipped: ${skipped}`);

    // Delete all existing opportunities
    const { error: delErr } = await supabase
      .from("opportunities")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
    console.log("Cleared opportunities table");

    // Insert in batches of 200
    const BATCH = 200;
    let inserted = 0;
    let errors = 0;
    const errorMsgs: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insErr } = await supabase.from("opportunities").insert(batch);
      if (insErr) {
        console.error(`Batch ${i} error:`, insErr.message);
        errorMsgs.push(`Batch ${i}: ${insErr.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
      if ((i / BATCH) % 5 === 0) console.log(`Progress: ${i + batch.length}/${rows.length}`);
    }

    console.log(`Done. Inserted: ${inserted}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, inserted, errors, skipped, total: rows.length, errorSamples: errorMsgs.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
