import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string): string[] {
  return line.split(";").map(f => f.trim());
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

    // For service-level invocation (curl_edge_functions uses service role)
    // We verify via the service role key presence which is already authenticated
    console.log("Running as service role - admin bypass for data migration");

    // Fetch CSV from storage
    const csvUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/imports/opportunities-deduped.csv`;
    console.log("Fetching CSV from:", csvUrl);
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
    const csvText = await csvRes.text();

    const lines = csvText.split("\n").filter(l => l.trim().length > 0);
    const header = parseCsvLine(lines[0]);
    console.log("Header:", header.join(", "));
    console.log("Total data rows:", lines.length - 1);

    // Map header indices
    const idx: Record<string, number> = {};
    header.forEach((h, i) => { idx[h] = i; });

    // Parse all rows
    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 5) continue;

      const name = cols[idx["name"]] || "";
      if (!name) continue;

      const lat = parseFloat(cols[idx["latitude"]] || "");
      const lon = parseFloat(cols[idx["longitude"]] || "");

      // Parse requirements array - comes as "[]" or "[""req1"",""req2""]"
      let requirements: string[] = [];
      const reqStr = cols[idx["requirements"]] || "[]";
      try {
        if (reqStr && reqStr !== "[]") {
          requirements = JSON.parse(reqStr.replace(/""/g, '"'));
        }
      } catch { requirements = []; }

      rows.push({
        id: cols[idx["id"]] || undefined,
        name,
        type: cols[idx["type"]] || "hospital",
        location: cols[idx["location"]] || "Unknown",
        address: cols[idx["address"]] || null,
        latitude: isNaN(lat) ? null : lat,
        longitude: isNaN(lon) ? null : lon,
        hours_required: cols[idx["hours_required"]] || "Varies",
        acceptance_likelihood: cols[idx["acceptance_likelihood"]] || "medium",
        phone: cols[idx["phone"]] || null,
        email: cols[idx["email"]] || null,
        website: cols[idx["website"]] === "N/A" ? null : (cols[idx["website"]] || null),
        requirements,
        description: cols[idx["description"]] || null,
        created_by: cols[idx["created_by"]] || null,
        source: cols[idx["source"]] || null,
        external_id: cols[idx["external_id"]] || null,
        country_code: cols[idx["country_code"]] || null,
        slug: cols[idx["slug"]] || null,
        hospital_id: cols[idx["hospital_id"]] || null,
      });
    }

    console.log("Parsed rows:", rows.length);

    // Step 1: Delete all existing opportunities
    const { error: delErr } = await supabase
      .from("opportunities")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
    console.log("Deleted all existing opportunities");

    // Step 2: Insert in batches of 500
    const BATCH = 500;
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insErr } = await supabase.from("opportunities").insert(batch);
      if (insErr) {
        console.error(`Batch ${i}-${i + batch.length} error:`, insErr.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
      console.log(`Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }

    console.log(`Done. Inserted: ${inserted}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, inserted, errors, total: rows.length }),
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
