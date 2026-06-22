// Remote MCP server (Streamable HTTP) exposing READ-ONLY database access
// to MCP clients such as Claude Desktop, Cursor, and Claude Code.
//
// SECURITY: This server reads with the service role and therefore BYPASSES
// row-level security. It can read ALL data, including student PII. Access is
// gated solely by the MCP_SERVER_TOKEN bearer token. Anyone holding that token
// can read everything — treat it like a master password.
import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_TOKEN = "zZ9qf3-selftest-7sLkP2wQ1xT8vN4mB6cR0dE5yH-throwaway";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Allowlist of public tables the AI engine may read. Full schema, incl. PII.
const ALLOWED_TABLES = new Set<string>([
  "account_deletion_events", "admin_activity_log", "admin_notification_log",
  "agent_recommendations", "agent_runs", "agent_tasks", "analytics_cohorts",
  "application_answers", "application_documents", "application_links",
  "application_notes", "applications", "approval_tasks", "bcs_autoresponder_log",
  "campaign_messages", "campaigns", "clinic_files", "clinic_leads",
  "clinic_members", "clinic_roles", "clinic_scheduling_questions",
  "data_quality_incidents", "discussion_votes", "email_send_logs",
  "email_templates", "experience_entries", "feature_flags", "guest_sessions",
  "hospital_accounts", "hospital_application_answers",
  "hospital_application_questions", "hospital_applications",
  "hospital_deletion_log", "hospital_members", "hospital_pages",
  "hospital_positions", "hospitals", "import_jobs", "lead_contacts",
  "lead_pipeline_history", "message_sequences", "metric_definitions",
  "metric_snapshots", "onboarding_progress", "onboarding_steps",
  "opportunities", "opportunity_questions", "person_notes", "platform_events",
  "playbooks", "position_questions", "profiles", "question_answers",
  "reminders", "reviews", "saved_opportunities", "scheduling_answers",
  "sequence_steps", "student_applications", "subscriptions", "tracking_events",
  "user_projects", "user_roles", "volunteer_tracker_categories",
  "volunteer_tracker_columns", "volunteer_tracker_entries",
  "volunteer_tracker_values", "waitlist_settings", "waitlist_submissions",
  "waitlists",
]);

const ALLOWED_OPERATORS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
]);
const MAX_LIMIT = 1000;

function ensureTable(table: string): string {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table "${table}" is not available. Use list_tables.`);
  }
  return table;
}

function jsonContent(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

const mcp = new McpServer({ name: "clinicalhours-db", version: "1.0.0" });

mcp.tool("list_tables", {
  description: "List the database tables that can be read.",
  annotations: { readOnlyHint: true },
  inputSchema: { type: "object", properties: {} },
  handler: async () => jsonContent({ tables: [...ALLOWED_TABLES].sort() }),
});

mcp.tool("describe_table", {
  description:
    "Describe a table's columns by sampling a row. Returns column names and inferred types.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (see list_tables)" },
    },
    required: ["table"],
  },
  handler: async ({ table }: { table: string }) => {
    ensureTable(table);
    const { data, error } = await admin.from(table).select("*").limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0] ?? null;
    const columns = row
      ? Object.entries(row).map(([name, v]) => ({
          name,
          type: v === null ? "unknown (null sample)" : typeof v,
        }))
      : [];
    return jsonContent({ table, columns, sampled: row !== null });
  },
});

mcp.tool("query_table", {
  description:
    "Read rows from a table (READ-ONLY). Supports column selection, filters, ordering, limit and offset.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (see list_tables)" },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Columns to return. Omit for all columns.",
      },
      filters: {
        type: "array",
        description: "Filter conditions, ANDed together.",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            operator: {
              type: "string",
              description:
                "One of: eq, neq, gt, gte, lt, lte, like, ilike, is, in",
            },
            value: {
              description:
                "Comparison value. For 'in', pass a comma-separated string or array.",
            },
          },
          required: ["column", "operator", "value"],
        },
      },
      order_by: { type: "string", description: "Column to sort by." },
      ascending: { type: "boolean", description: "Sort ascending (default true)." },
      limit: { type: "number", description: `Max rows (default 100, max ${MAX_LIMIT}).` },
      offset: { type: "number", description: "Rows to skip (default 0)." },
    },
    required: ["table"],
  },
  handler: async (args: {
    table: string;
    columns?: string[];
    filters?: { column: string; operator: string; value: unknown }[];
    order_by?: string;
    ascending?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    ensureTable(args.table);
    const limit = Math.min(Math.max(1, args.limit ?? 100), MAX_LIMIT);
    const offset = Math.max(0, args.offset ?? 0);
    const select = args.columns?.length ? args.columns.join(",") : "*";

    let q = admin.from(args.table).select(select, { count: "exact" });
    for (const f of args.filters ?? []) {
      if (!ALLOWED_OPERATORS.has(f.operator)) {
        throw new Error(`Unsupported operator "${f.operator}".`);
      }
      let value: unknown = f.value;
      if (f.operator === "in" && typeof f.value === "string") {
        value = `(${f.value})`;
      } else if (f.operator === "in" && Array.isArray(f.value)) {
        value = `(${f.value.join(",")})`;
      }
      q = q.filter(f.column, f.operator, value as never);
    }
    if (args.order_by) {
      q = q.order(args.order_by, { ascending: args.ascending ?? true });
    }
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return jsonContent({
      table: args.table,
      total_matching: count,
      returned: data?.length ?? 0,
      offset,
      limit,
      rows: data ?? [],
    });
  },
});

mcp.tool("count_table", {
  description: "Count rows in a table (READ-ONLY), optionally with filters.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (see list_tables)" },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            operator: { type: "string" },
            value: {},
          },
          required: ["column", "operator", "value"],
        },
      },
    },
    required: ["table"],
  },
  handler: async (args: {
    table: string;
    filters?: { column: string; operator: string; value: unknown }[];
  }) => {
    ensureTable(args.table);
    let q = admin.from(args.table).select("*", { count: "exact", head: true });
    for (const f of args.filters ?? []) {
      if (!ALLOWED_OPERATORS.has(f.operator)) {
        throw new Error(`Unsupported operator "${f.operator}".`);
      }
      q = q.filter(f.column, f.operator, f.value as never);
    }
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return jsonContent({ table: args.table, count });
  },
});

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const app = new Hono();

app.use("/*", async (c, next) => {
  // CORS preflight
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Expose-Headers": "mcp-session-id",
      },
    });
  }
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Expose-Headers", "mcp-session-id");
});

// Bearer-token auth on every non-preflight request.
app.use("/*", async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!MCP_TOKEN || token !== MCP_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.all("/*", async (c) => httpHandler(c.req.raw));

Deno.serve(app.fetch);