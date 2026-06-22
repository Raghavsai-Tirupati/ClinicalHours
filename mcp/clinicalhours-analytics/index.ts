#!/usr/bin/env node
/**
 * MCP server — live ClinicalHours data via the student-analytics edge function.
 * Cursor spawns this over stdio; reads SUPABASE_URL + ANALYTICS_API_TOKEN from .env.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyticsRequest, asJsonText } from "./client.js";

const server = new McpServer({
  name: "clinicalhours-analytics",
  version: "1.0.0",
});

const filterSchema = z
  .record(z.string())
  .optional()
  .describe('PostgREST filters, e.g. { "status": "eq.pending", "created_at": "gte.2026-01-01" }');

server.registerTool(
  "list_tables",
  {
    description:
      "List all database tables and views readable through the analytics API (profiles, student_applications, admin_student_summary, etc.)",
    inputSchema: z.object({}),
  },
  async () => {
    const data = await analyticsRequest({ table: "_list" });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "query_table",
  {
    description:
      "Query rows from a table or view. Supports select, order, limit, offset, and PostgREST-style filters.",
    inputSchema: z.object({
      table: z.string().describe("Table name from list_tables, or alias like students, applications, summary"),
      select: z.string().optional().describe('Columns to return, comma-separated. Default "*".'),
      limit: z.number().int().min(1).max(1000).optional().describe("Max rows (default 100, max 1000)"),
      offset: z.number().int().min(0).optional(),
      order: z.string().optional().describe('Sort column, e.g. "created_at.desc" or "last_active_at desc"'),
      count_only: z.boolean().optional().describe("If true, return only the row count"),
      filters: filterSchema,
    }),
  },
  async ({ table, select, limit, offset, order, count_only, filters }) => {
    const params: Record<string, string | number | boolean | undefined> = {
      table,
      select,
      limit,
      offset,
      order,
      count_only,
    };
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        params[key] = value;
      }
    }
    const data = await analyticsRequest(params);
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "analytics_kpis",
  {
    description: "Dashboard KPIs: signups, active users, applications, interviews, evaluations, attention counts",
    inputSchema: z.object({
      since: z.string().optional().describe("ISO date lower bound"),
      until: z.string().optional().describe("ISO date upper bound"),
      clinic_id: z.string().uuid().optional(),
    }),
  },
  async ({ since, until, clinic_id }) => {
    const data = await analyticsRequest({ analytics: "kpis", since, until, clinic_id });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "analytics_timeseries",
  {
    description:
      "Time series for a metric: new_users, active_users, logins, applications, evaluations, avg_evaluation_score",
    inputSchema: z.object({
      metric: z
        .enum([
          "new_users",
          "active_users",
          "logins",
          "applications",
          "evaluations",
          "avg_evaluation_score",
        ])
        .optional(),
      granularity: z.enum(["hour", "day", "week", "month"]).optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      clinic_id: z.string().uuid().optional(),
    }),
  },
  async ({ metric, granularity, since, until, clinic_id }) => {
    const data = await analyticsRequest({
      analytics: "timeseries",
      metric,
      granularity,
      since,
      until,
      clinic_id,
    });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "analytics_funnel",
  {
    description: "Promotion funnel metrics for a date range",
    inputSchema: z.object({
      since: z.string().optional(),
      until: z.string().optional(),
    }),
  },
  async ({ since, until }) => {
    const data = await analyticsRequest({ analytics: "funnel", since, until });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "analytics_student",
  {
    description: "Full analytics bundle for one student (profile, apps, events, evaluations, activity)",
    inputSchema: z.object({
      user_id: z.string().uuid().describe("Student profile UUID"),
    }),
  },
  async ({ user_id }) => {
    const data = await analyticsRequest({ analytics: "student", user_id });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "analytics_cohort",
  {
    description:
      "Filter students by engagement criteria: inactivity, clinical hours, applications, graduation year, premium, attention flags",
    inputSchema: z.object({
      inactive_days_min: z.number().int().optional(),
      signed_up_days_max: z.number().int().optional(),
      min_clinical_hours: z.number().optional(),
      min_applications: z.number().int().optional(),
      graduation_year: z.number().int().optional(),
      has_premium: z.boolean().optional(),
      needs_attention: z.boolean().optional(),
      saved_not_applied: z.boolean().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      offset: z.number().int().min(0).optional(),
    }),
  },
  async (filter) => {
    const { limit, offset, ...rest } = filter;
    const params: Record<string, string | number | boolean | undefined> = {
      analytics: "cohort",
      limit,
      offset,
    };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) params[key] = value;
    }
    const data = await analyticsRequest(params);
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

server.registerTool(
  "list_analytics_reports",
  {
    description: "List available curated analytics report types and their query parameters",
    inputSchema: z.object({}),
  },
  async () => {
    const data = await analyticsRequest({ analytics: "_list" });
    return { content: [{ type: "text", text: asJsonText(data) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("clinicalhours-analytics MCP failed:", err);
  process.exit(1);
});
