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

// Analytics views that aren't returned by list_public_tables (which is tables-only)
// but are safe, admin-equivalent read surfaces. admin_student_summary is where
// last_login_at / last_active_at / attention_level live.
const EXTRA_VIEWS = ["admin_student_summary"];

// Whitelisted admin analytics RPCs exposed via ?analytics=<key>.
// The edge function runs with the service role, so assert_admin() inside these
// functions passes (auth.uid() is null in that context).
const ANALYTICS_RPCS: Record<string, string> = {
  kpis: "get_admin_dashboard_kpis",
  timeseries: "get_admin_time_series",
  funnel: "get_promotion_funnel",
  student: "get_student_analytics_bundle",
  cohort: "run_cohort_filter",
};

const FIELD_ALIASES: Record<string, Record<string, string>> = {
  profiles: {
    name: "full_name",
    student_name: "full_name",
    signup_date: "created_at",
    signed_up_at: "created_at",
    signup_time: "created_at",
  },
  student_applications: {
    name: "applicant_name",
    email: "applicant_email",
    created_at: "submitted_at",
    signup_date: "submitted_at",
  },
  hospital_applications: {
    name: "applicant_name",
    email: "applicant_email",
  },
};

const resolveField = (table: string, field: string) => {
  const trimmed = field.trim();
  return FIELD_ALIASES[table]?.[trimmed.toLowerCase()] ?? trimmed;
};

const resolveSelect = (table: string, select: string) => {
  if (!select || select === "*") return "*";
  return select
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed || trimmed.includes(":")) return trimmed;
      return resolveField(table, trimmed);
    })
    .join(",");
};

type QueryOptions = {
  select: string;
  countOnly: boolean;
  offset: number;
  limit: number;
  order: string | null;
  applyFilters: boolean;
};

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
    const rawTable = params.get("table");
    console.log("student-analytics request:", JSON.stringify(Object.fromEntries(params.entries())));

    if (!rawTable || rawTable === "_list") {
      return json({ tables: available });
    }

    // Resolve the requested table tolerantly: exact match, then case-insensitive,
    // then a few common natural-language aliases the agent tends to guess.
    const ALIASES: Record<string, string> = {
      students: "profiles",
      student: "profiles",
      users: "profiles",
      user: "profiles",
      applications: "student_applications",
      experiences: "experience_entries",
      saved: "saved_opportunities",
      events: "tracking_events",
      subscription: "subscriptions",
    };
    const lowered = rawTable.toLowerCase();
    const table =
      available.find((t) => t === rawTable) ??
      available.find((t) => t.toLowerCase() === lowered) ??
      (ALIASES[lowered] && available.includes(ALIASES[lowered]) ? ALIASES[lowered] : undefined);

    if (!table) {
      return json(
        {
          error: `Unknown or restricted table '${rawTable}'. Use table=_list to see all readable tables.`,
          tables: available,
        },
        400,
      );
    }

    const select = resolveSelect(table, params.get("select") ?? "*");
    const limit = Math.min(Number(params.get("limit") ?? 100) || 100, MAX_LIMIT);
    const offset = Number(params.get("offset") ?? 0) || 0;

    // count_only=true returns just the total without fetching rows
    const countOnly = params.get("count_only") === "true";

    const buildQuery = (options: QueryOptions) => {
      let query = options.countOnly
        ? supabase.from(table).select("*", { count: "exact", head: true })
        : supabase
            .from(table)
            .select(options.select, { count: "exact" })
            .range(options.offset, options.offset + options.limit - 1);

      // Optional ordering: accepts "column.desc", "column desc", or just "column".
      if (options.order) {
        const [col, dir] = options.order.trim().split(/[.\s]+/);
        if (col) query = query.order(resolveField(table, col), { ascending: (dir ?? "asc").toLowerCase() !== "desc" });
      }

      if (!options.applyFilters) return query;

      // Optional filters: ?column=op.value where op is one of the PostgREST operators.
      // Examples: created_at=gte.2026-06-18  status=eq.active  role=in.(admin,user)
      const reserved = new Set(["table", "select", "limit", "offset", "order", "token", "count_only"]);
      const OPS = ["gte", "lte", "gt", "lt", "neq", "eq", "ilike", "like", "in", "is"];
      for (const [key, value] of params.entries()) {
        if (reserved.has(key)) continue;
        const column = resolveField(table, key);
        const m = value.match(/^([a-z]+)\.(.*)$/i);
        if (!m) continue;
        const op = m[1].toLowerCase();
        const val: string = m[2];
        if (!OPS.includes(op)) continue;
        if (op === "in") {
          const items = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
          query = query.in(column, items);
        } else if (op === "is") {
          const lowered = val.toLowerCase();
          const parsed = lowered === "null" ? null : lowered === "true" ? true : lowered === "false" ? false : val;
          query = query.is(column, parsed as null | boolean);
        } else {
          // gte | lte | gt | lt | neq | eq | like | ilike
          // deno-lint-ignore no-explicit-any
          query = (query as any)[op](column, val);
        }
      }

      return query;
    };

    const order = params.get("order");
    let result = await buildQuery({ select, countOnly, offset, limit, order, applyFilters: true });
    const warnings: string[] = [];

    if (result.error && !countOnly && select !== "*") {
      warnings.push(`Requested select failed (${result.error.message}); retried with all columns.`);
      result = await buildQuery({ select: "*", countOnly, offset, limit, order, applyFilters: true });
    }

    if (result.error && order) {
      warnings.push(`Requested order failed (${result.error.message}); retried without ordering.`);
      result = await buildQuery({ select: countOnly ? select : "*", countOnly, offset, limit, order: null, applyFilters: true });
    }

    if (result.error) {
      warnings.push(`Requested filters failed (${result.error.message}); retried without filters.`);
      result = await buildQuery({ select: countOnly ? select : "*", countOnly, offset, limit, order: null, applyFilters: false });
    }

    const { data, error, count } = result;
    if (error) return json({ error: error.message, warnings }, 400);

    return json({
      table,
      returned: data?.length ?? 0,
      total: count ?? null,
      data: countOnly ? undefined : data,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});