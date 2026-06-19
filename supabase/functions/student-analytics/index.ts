import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Tables this endpoint is allowed to read. Read-only by design.
const ALLOWED_TABLES = new Set([
  "profiles",
  "student_applications",
  "experience_entries",
  "saved_opportunities",
  "tracking_events",
  "reviews",
  "subscriptions",
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

    const table = params.get("table") ?? "profiles";
    if (!ALLOWED_TABLES.has(table)) {
      return json(
        { error: `Unknown table '${table}'`, allowed: [...ALLOWED_TABLES] },
        400,
      );
    }

    const select = params.get("select") ?? "*";
    const limit = Math.min(Number(params.get("limit") ?? 100) || 100, MAX_LIMIT);
    const offset = Number(params.get("offset") ?? 0) || 0;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let query = supabase.from(table).select(select).range(offset, offset + limit - 1);

    // Optional ordering: order=column.desc or order=column.asc
    const order = params.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      if (col) query = query.order(col, { ascending: dir !== "desc" });
    }

    // Optional simple equality filters: any other ?col=eq.value pair
    const reserved = new Set(["table", "select", "limit", "offset", "order", "token"]);
    for (const [key, value] of params.entries()) {
      if (reserved.has(key)) continue;
      const m = value.match(/^eq\.(.*)$/);
      if (m) query = query.eq(key, m[1]);
    }

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 400);

    return json({ table, count: data?.length ?? 0, total: count ?? null, data });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});