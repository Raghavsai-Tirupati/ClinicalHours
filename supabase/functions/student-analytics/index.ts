import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Pure-credential / security tables: no analytical value, real risk if exposed.
// Everything else in the public schema is readable.
const DENY_TABLES = new Set([
  "password_reset_tokens",
  "email_verification_tokens",
  "oauth_states",
  "edge_function_rate_limits",
]);

const MAX_LIMIT = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // --- Auth: require the shared analytics token ---
  const expected = Deno.env.get("ANALYTICS_API_TOKEN");
  if (!expected) {
    return json({ error: "Server not configured: ANALYTICS_API_TOKEN missing" }, 500);
  }
  const provided =
    req.headers.get("x-api-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(req.url).searchParams.get("token");

  if (provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Discover every table in the database (minus the denylist).
    const { data: tableRows, error: listErr } = await supabase.rpc("list_public_tables");
    if (listErr) return json({ error: listErr.message }, 500);
    const available = (tableRows ?? [])
      .map((r: { table_name: string }) => r.table_name)
      .filter((t: string) => !DENY_TABLES.has(t));

    // table=_list (or no table) returns the catalog of readable tables.
    const table = params.get("table");
    if (!table || table === "_list") {
      return json({ tables: available });
    }
    if (!available.includes(table)) {
      return json({ error: `Unknown or restricted table '${table}'`, tables: available }, 400);
    }

    const select = params.get("select") ?? "*";
    const limit = Math.min(Number(params.get("limit") ?? 100) || 100, MAX_LIMIT);
    const offset = Number(params.get("offset") ?? 0) || 0;

    // count_only=true returns just the total without fetching rows
    const countOnly = params.get("count_only") === "true";

    let query = countOnly
      ? supabase.from(table).select("*", { count: "exact", head: true })
      : supabase
          .from(table)
          .select(select, { count: "exact" })
          .range(offset, offset + limit - 1);

    // Optional ordering: order=column.desc or order=column.asc
    const order = params.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      if (col) query = query.order(col, { ascending: dir !== "desc" });
    }

    // Optional simple equality filters: any other ?col=eq.value pair
    const reserved = new Set(["table", "select", "limit", "offset", "order", "token", "count_only"]);
    for (const [key, value] of params.entries()) {
      if (reserved.has(key)) continue;
      const m = value.match(/^eq\.(.*)$/);
      if (m) query = query.eq(key, m[1]);
    }

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 400);

    return json({
      table,
      returned: data?.length ?? 0,
      total: count ?? null,
      data: countOnly ? undefined : data,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});